import { useEffect, useState } from "react";
import { onProgressChanged } from "../api/events";
import { getSolved, listExercises, type Exercise, type SolvedEntry } from "../api/exercises";

export type CatalogState =
  | { status: "loading" }
  | { status: "ready"; exercises: Exercise[] }
  | { status: "failed"; message: string };

export interface Exercises {
  catalog: CatalogState;
  solved: SolvedEntry[];
  /** Reads the solved exercises again; call it after a successful check. */
  refreshSolved: () => Promise<void>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

/** The exercise catalog, and which exercises the learner has solved. */
export function useExercises(): Exercises {
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [solved, setSolved] = useState<SolvedEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listExercises(), getSolved()])
      .then(([exercises, entries]) => {
        if (cancelled) return;
        setCatalog({ status: "ready", exercises });
        setSolved(entries);
      })
      .catch((error: unknown) => {
        if (!cancelled) setCatalog({ status: "failed", message: toMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Progress made on another computer arrives a moment after the app opens.
  useEffect(() => {
    let cancelled = false;
    const stop = onProgressChanged(() => {
      getSolved()
        .then((entries) => {
          if (!cancelled) setSolved(entries);
        })
        .catch((error: unknown) => {
          if (!cancelled) setCatalog({ status: "failed", message: toMessage(error) });
        });
    });
    return () => {
      cancelled = true;
      void stop.then((unlisten) => {
        unlisten();
      });
    };
  }, []);

  async function refreshSolved() {
    try {
      setSolved(await getSolved());
    } catch (error) {
      setCatalog({ status: "failed", message: toMessage(error) });
    }
  }

  return { catalog, solved, refreshSolved };
}
