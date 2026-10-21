import type { Exercise } from "../api/exercises";
import type { Reward } from "../xp";
import { CheckIcon } from "./CheckIcon";
import { CountUp } from "./CountUp";
import { NavIcon } from "./NavIcon";

interface SolvedFeedbackProps {
  /** What this success earned, or `null` when it was solved before in another language. */
  reward: Reward | null;
  /** How many hidden tests the program passed. */
  hiddenTests: number;
  /** Exercises solved, this one included, out of how many exist. */
  solvedCount: number;
  total: number;
  next: Exercise | null;
  onOpenNext: (id: string) => void;
  onBack: () => void;
}

/** What the learner sees when an exercise is solved: a clear success, and where to go next. */
export function SolvedFeedback({
  reward,
  hiddenTests,
  solvedCount,
  total,
  next,
  onOpenNext,
  onBack,
}: SolvedFeedbackProps) {
  const everythingSolved = solvedCount >= total;

  return (
    <section className="solved" aria-label="Exercice réussi">
      <div className="solved-badge">
        <CheckIcon strokeWidth={2.5} draw />
      </div>
      <div className="solved-body">
        <h3 className="solved-title">Exercice réussi !</h3>
        <p className="solved-text">
          Ta solution passe tous les tests, y compris{" "}
          <span className="tabular-nums">{hiddenTests}</span> tests cachés tirés au hasard.
        </p>
        {reward !== null && (
          <p className="solved-reward">
            <span className="badge badge-success tabular-nums">+{reward.xp} XP</span>
            <span className="badge badge-success tabular-nums">
              <NavIcon name="coin" />+<CountUp value={reward.coins} from={0} /> pièces
            </span>
          </p>
        )}
        <p className="solved-progress">
          <progress value={solvedCount} max={total}>
            {solvedCount} / {total}
          </progress>
          <span className="tabular-nums">
            {solvedCount} / {total}
          </span>{" "}
          exercices résolus
        </p>
        <div className="button-row">
          {next && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onOpenNext(next.id);
              }}
            >
              Exercice suivant : {next.title}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Tous les exercices
          </button>
        </div>
        {everythingSolved && (
          <p className="solved-text">Tu as résolu tous les exercices. Bravo !</p>
        )}
      </div>
    </section>
  );
}
