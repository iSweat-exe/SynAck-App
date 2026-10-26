import { useEffect, useState } from "react";
import { onProgressChanged } from "../api/events";
import { getValidatedProtocols } from "../api/protocols";

export interface ValidatedProtocols {
  ids: ReadonlySet<string>;
  /** Set when the list could not be read: the protocols would wrongly look unvalidated. */
  error: string | null;
  /** Reads the list again; call it after a quiz was passed. */
  refresh: () => Promise<void>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

/** Which protocols the learner has validated by passing their quiz. */
export function useValidatedProtocols(): ValidatedProtocols {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getValidatedProtocols()
      .then((list) => {
        if (!cancelled) setIds(new Set(list));
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(toMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Progress made on another computer arrives a moment after the app opens.
  useEffect(() => {
    let cancelled = false;
    const stop = onProgressChanged(() => {
      getValidatedProtocols()
        .then((list) => {
          if (!cancelled) setIds(new Set(list));
        })
        .catch((failure: unknown) => {
          if (!cancelled) setError(toMessage(failure));
        });
    });
    return () => {
      cancelled = true;
      void stop.then((unlisten) => {
        unlisten();
      });
    };
  }, []);

  async function refresh() {
    try {
      setIds(new Set(await getValidatedProtocols()));
      setError(null);
    } catch (failure) {
      setError(toMessage(failure));
    }
  }

  return { ids, error, refresh };
}
