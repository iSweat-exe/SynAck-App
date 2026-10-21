import type { Exercise, SolvedEntry } from "../api/exercises";
import { DIFFICULTY_LABEL } from "../exercises/labels";
import { CheckIcon } from "./CheckIcon";

interface ExerciseListProps {
  exercises: readonly Exercise[];
  solved: readonly SolvedEntry[];
  onOpen: (id: string) => void;
  /** Shown when the filters leave nothing. */
  onReset: () => void;
}

export function ExerciseList({ exercises, solved, onOpen, onReset }: ExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <div className="empty card">
        <p>Aucun exercice ne correspond à ces filtres.</p>
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Réinitialiser les filtres
        </button>
      </div>
    );
  }

  return (
    <ul className="exercise-grid">
      {exercises.map((exercise) => {
        // Solved is a fact about the exercise: the language it was solved in does not matter.
        const isSolved = solved.some((entry) => entry.exercise === exercise.id);
        return (
          <li key={exercise.id}>
            <button
              type="button"
              className="card exercise-card"
              data-solved={isSolved}
              onClick={() => {
                onOpen(exercise.id);
              }}
            >
              <span className="exercise-card-title">{exercise.title}</span>
              <span className="exercise-card-summary">{exercise.summary}</span>
              <span className="exercise-card-topics">{exercise.topics.join(", ")}</span>
              <span className="exercise-card-badges">
                <span className="badge">{DIFFICULTY_LABEL[exercise.difficulty]}</span>
                {isSolved && (
                  <span className="badge badge-success">
                    <CheckIcon />
                    Résolu
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
