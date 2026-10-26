import { useState } from "react";
import { getSolution, type Solution } from "../api/exercises";
import { Markdown } from "./Markdown";

type SolutionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; solution: Solution }
  | { status: "failed"; message: string };

interface ExerciseSolutionProps {
  exerciseId: string;
  language: string;
  /** The name shown for the language, e.g. "Python". */
  languageName: string;
}

/**
 * The walkthrough of a solved exercise: the explanation and the reference solution. Only the Rust
 * side decides whether the learner may see it, so asking before solving gets a refusal.
 */
export function ExerciseSolution({ exerciseId, language, languageName }: ExerciseSolutionProps) {
  const [state, setState] = useState<SolutionState>({ status: "idle" });

  async function open() {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", solution: await getSolution(exerciseId, language) });
    } catch (error) {
      setState({
        status: "failed",
        message: error instanceof Error ? error.message : "Erreur inconnue.",
      });
    }
  }

  return (
    <section className="card solution" aria-label="Corrigé">
      <h3 className="label">Corrigé et explication</h3>
      {state.status !== "ready" && (
        <>
          <p className="hints-intro">
            Tu as résolu cet exercice : compare ta méthode avec celle du corrigé, et lis pourquoi
            elle marche.
          </p>
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={state.status === "loading"}
              aria-busy={state.status === "loading"}
              onClick={() => void open()}
            >
              Voir le corrigé et l&apos;explication
            </button>
          </div>
        </>
      )}
      {state.status === "failed" && <p className="alert alert-danger">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <div className="prose">
            <Markdown>{state.solution.explanation}</Markdown>
          </div>
          <div>
            <h4 className="label">Corrigé en {languageName}</h4>
            <pre className="snippet">{state.solution.code}</pre>
          </div>
        </>
      )}
    </section>
  );
}
