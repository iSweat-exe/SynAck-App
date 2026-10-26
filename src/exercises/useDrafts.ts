import { useEffect, useRef, useState } from "react";
import { getDrafts, saveDraft } from "../api/drafts";
import { onProgressChanged } from "../api/events";
import { draftKey, mergeDrafts } from "./drafts";

/** How long the learner must stop typing before the code is kept. */
const SAVE_DELAY_MS = 800;

export interface Drafts {
  /** The code kept for every exercise and language, by `draftKey`. */
  record: Readonly<Record<string, string>>;
  /** Shows this code at once and keeps it a moment later, once typing pauses. */
  set: (exercise: string, language: string, code: string) => void;
}

interface Pending {
  exercise: string;
  language: string;
  code: string;
}

/** The code the learner wrote in exercises, kept between launches and between computers. */
export function useDrafts(): Drafts {
  const [record, setRecord] = useState<Record<string, string>>({});
  // What was typed since the app opened: a reading from the Rust side never replaces it.
  const edited = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, Pending>());

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      getDrafts()
        .then((loaded) => {
          if (!cancelled) setRecord((previous) => mergeDrafts(previous, loaded, edited.current));
        })
        .catch(() => {
          // The drafts are a comfort: without them the starter code is shown, nothing is lost.
        });
    };
    read();
    // Code written on another computer arrives a moment after the app opens.
    const stop = onProgressChanged(read);
    return () => {
      cancelled = true;
      void stop.then((unlisten) => {
        unlisten();
      });
    };
  }, []);

  // Closing the screen must not lose what was typed in the last moments.
  useEffect(() => {
    const waiting = pending.current;
    const clocks = timers.current;
    return () => {
      for (const clock of clocks.values()) clearTimeout(clock);
      for (const draft of waiting.values()) {
        void saveDraft(draft.exercise, draft.language, draft.code).catch(() => undefined);
      }
    };
  }, []);

  function set(exercise: string, language: string, code: string) {
    const key = draftKey(exercise, language);
    edited.current.add(key);
    setRecord((previous) => ({ ...previous, [key]: code }));
    pending.current.set(key, { exercise, language, code });
    const earlier = timers.current.get(key);
    if (earlier !== undefined) clearTimeout(earlier);
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        pending.current.delete(key);
        // A draft that cannot be kept (too long) is not worth interrupting the learner: the size
        // is already shown under the editor.
        void saveDraft(exercise, language, code).catch(() => undefined);
      }, SAVE_DELAY_MS),
    );
  }

  return { record, set };
}
