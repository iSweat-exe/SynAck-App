import { useEffect, useState } from "react";
import { checkEnvironment, type ToolStatus } from "../api/environment";

export type EnvironmentState =
  | { status: "loading" }
  | { status: "ready"; tools: ToolStatus[] }
  | { status: "failed"; message: string };

export interface Environment {
  state: EnvironmentState;
  recheck: () => void;
}

/** Detects the installed languages once, and again each time `recheck` is called. */
export function useEnvironment(): Environment {
  const [state, setState] = useState<EnvironmentState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    checkEnvironment()
      .then((tools) => {
        if (!cancelled) setState({ status: "ready", tools });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : "Erreur inconnue.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function recheck() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  return { state, recheck };
}
