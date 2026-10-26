import type { Draft } from "../api/drafts";
import type { Exercise } from "../api/exercises";

/** Where the code of an exercise in a language is kept in a record of drafts. */
export function draftKey(exercise: string, language: string): string {
  return `${exercise}:${language}`;
}

/**
 * Puts the drafts read from the Rust side in the ones already shown. What the learner typed since
 * the app opened (`edited`) is never replaced: their latest keystrokes win over a reading.
 */
export function mergeDrafts(
  previous: Readonly<Record<string, string>>,
  loaded: readonly Draft[],
  edited: ReadonlySet<string>,
): Record<string, string> {
  const merged = { ...previous };
  for (const draft of loaded) {
    const key = draftKey(draft.exercise, draft.language);
    if (!edited.has(key)) merged[key] = draft.code;
  }
  return merged;
}

/**
 * The exercises in progress: not solved, and with code that is neither empty nor the starter code
 * in at least one language.
 */
export function inProgressIds(
  exercises: readonly Exercise[],
  solvedIds: ReadonlySet<string>,
  drafts: Readonly<Record<string, string>>,
): Set<string> {
  const ids = new Set<string>();
  for (const exercise of exercises) {
    if (solvedIds.has(exercise.id)) continue;
    const started = Object.entries(exercise.starters).some(([language, starter]) => {
      const code = (drafts[draftKey(exercise.id, language)] ?? "").trim();
      return code !== "" && code !== starter.trim();
    });
    if (started) ids.add(exercise.id);
  }
  return ids;
}
