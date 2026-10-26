import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/** What the fake backend starts with. */
export interface BackendSetup {
  /** Whether the account is already signed in when the page opens. */
  signedIn: boolean;
  /** The answers of the first-launch questions, or `null` to be asked them. */
  onboarding: Record<string, unknown> | null;
}

export const BEGINNER = {
  level: "beginner",
  goals: ["web"],
  knownLanguages: ["python"],
  motivation: "curiosity",
  weeklyTime: "oneToThree",
  styles: ["practice"],
};

/** The real catalog of exercises, in the order the Rust side lists them (`SOURCES`). */
export function readExercises(): unknown[] {
  const rust = join(import.meta.dirname, "..", "src-tauri");
  const order = [
    ...readFileSync(join(rust, "src", "exercises.rs"), "utf8").matchAll(
      /exercises\/(\w+)\/exercise\.json/g,
    ),
  ];
  return order.map(
    (match) =>
      JSON.parse(
        readFileSync(join(rust, "exercises", String(match[1]), "exercise.json"), "utf8"),
      ) as unknown,
  );
}

interface Injected {
  setup: BackendSetup;
  /** The exercises, in the order the application shows them. */
  exercises: { id: string; title: string }[];
}

/**
 * Runs in the page, before the application: the Rust side is replaced by a small backend that
 * keeps its state in `localStorage` (so it survives a reload, like the real databases do).
 * Nothing here is shared with the test: the function is sent to the page as text.
 */
function fakeBackend(injected: Injected) {
  const STORAGE = "fake-backend";
  const user = {
    id: "00000000-0000-0000-0000-00000000e2e0",
    name: "Élève de test",
    avatarUrl: null,
    provider: "github",
  };

  /** What a command refuses with: it reaches the application as a ready-to-display message. */
  class Refusal extends Error {}

  interface State {
    signedIn: boolean;
    onboarding: Record<string, unknown> | null;
    solved: { exercise: string; language: string; solvedAt: string }[];
    drafts: Record<string, { exercise: string; language: string; code: string }>;
  }

  const saved = window.localStorage.getItem(STORAGE);
  const state: State =
    saved === null
      ? {
          signedIn: injected.setup.signedIn,
          onboarding: injected.setup.onboarding,
          solved: [],
          drafts: {},
        }
      : (JSON.parse(saved) as State);
  const persist = () => {
    window.localStorage.setItem(STORAGE, JSON.stringify(state));
  };

  const callbacks = new Map<number, (data: unknown) => void>();
  let nextId = 1;
  const listeners = new Map<string, number[]>();

  const reportOf = (solved: boolean) => ({
    compileError: null,
    examples: [
      {
        input: "",
        expected: "",
        actual: solved ? "" : "faux",
        stderr: "",
        passed: solved,
        diff: solved ? null : { line: 1, expected: "", actual: "faux" },
        timedOut: false,
        exitCode: 0,
      },
    ],
    hidden: solved ? { total: 8, passed: 8, failures: [] } : null,
    solved,
  });

  const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
    current_user: () => (state.signedIn ? user : null),
    sign_in: () => {
      state.signedIn = true;
      persist();
      return user;
    },
    sign_out: () => {
      state.signedIn = false;
      persist();
      return null;
    },
    cancel_sign_in: () => null,
    get_onboarding: () => state.onboarding,
    save_onboarding: (args) => {
      state.onboarding = args.answers as Record<string, unknown>;
      persist();
      return null;
    },
    list_exercises: () => injected.exercises,
    check_environment: () => [
      {
        id: "python",
        name: "Python",
        installed: true,
        path: "python",
        version: "3.14",
        install: null,
      },
      {
        id: "javascript",
        name: "JavaScript (Node.js)",
        installed: true,
        path: "node",
        version: "24",
        install: null,
      },
    ],
    get_solved: () => state.solved,
    get_validated_protocols: () => [],
    get_drafts: () => Object.values(state.drafts),
    save_draft: (args) => {
      const exercise = String(args.exercise);
      const language = String(args.language);
      state.drafts[`${exercise}:${language}`] = { exercise, language, code: String(args.code) };
      persist();
      return null;
    },
    get_streak: () => (state.solved.length > 0 ? 1 : 0),
    check_exercise: (args) => {
      // The fake judge: code that contains SOLVED passes everything, nothing else does.
      const solved = String(args.code).includes("SOLVED") && args.mode === "submit";
      if (solved) {
        const exercise = String(args.exercise);
        const language = String(args.language);
        if (!state.solved.some((row) => row.exercise === exercise && row.language === language)) {
          state.solved.push({ exercise, language, solvedAt: "2026-10-26 12:00:00" });
          persist();
        }
      }
      return reportOf(solved);
    },
    get_solution: (args) => {
      const exercise = String(args.exercise);
      if (!state.solved.some((row) => row.exercise === exercise)) {
        throw new Refusal("Résous l'exercice pour voir son corrigé.");
      }
      return {
        language: String(args.language),
        code: `# corrigé de ${exercise}`,
        explanation: `Explication de **${exercise}**.`,
      };
    },
  };

  const internals = {
    transformCallback(callback: (data: unknown) => void) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    unregisterCallback(id: number) {
      callbacks.delete(id);
    },
    invoke(command: string, args: Record<string, unknown> = {}): Promise<unknown> {
      if (command === "plugin:event|listen") {
        const event = String(args.event);
        listeners.set(event, [...(listeners.get(event) ?? []), Number(args.handler)]);
        return Promise.resolve(args.handler);
      }
      if (command === "plugin:event|unlisten") return Promise.resolve(null);
      const handler = handlers[command];
      // Like the real Rust side, a command refuses with a plain, ready-to-display string.
      /* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
      if (handler === undefined) return Promise.reject(`Commande inconnue : ${command}`);
      try {
        return Promise.resolve(handler(args));
      } catch (failure) {
        // The real Rust side rejects with a ready-to-display message.
        return Promise.reject(failure instanceof Refusal ? failure.message : String(failure));
      }
      /* eslint-enable @typescript-eslint/prefer-promise-reject-errors */
    },
  };
  Object.assign(window, {
    __TAURI_INTERNALS__: internals,
    __TAURI_EVENT_PLUGIN_INTERNALS__: {
      unregisterListener: (_event: string, id: number) => {
        callbacks.delete(id);
      },
    },
  });
}

/** Replaces the Rust side of the application with a fake backend, for this page. */
export async function installFakeTauri(
  page: Page,
  setup: Partial<BackendSetup> = {},
): Promise<void> {
  const exercises = readExercises();
  const injected: Injected = {
    setup: { signedIn: true, onboarding: BEGINNER, ...setup },
    exercises: exercises as Injected["exercises"],
  };
  await page.addInitScript(fakeBackend, injected);
}
