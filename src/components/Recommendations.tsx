import { DIFFICULTY_LABEL } from "../exercises/labels";
import type { Recommendation } from "../exercises/recommend";

interface RecommendationsProps {
  /** The exercises to suggest; empty when everything is solved. */
  items: readonly Recommendation[];
  onOpen: (id: string) => void;
}

/** "Recommandé pour toi": the next exercises that fit the answers of the learner. */
export function Recommendations({ items, onOpen }: RecommendationsProps) {
  if (items.length === 0) {
    return (
      <section className="card recommendations" aria-label="Recommandations">
        <h3 className="label">Recommandé pour toi</h3>
        <p className="hints-intro">Tu as résolu tous les exercices. Bravo !</p>
      </section>
    );
  }
  return (
    <section className="recommendations" aria-label="Recommandations">
      <h3 className="label">Recommandé pour toi</h3>
      <ul className="exercise-grid">
        {items.map(({ exercise, reasons }) => (
          <li key={exercise.id}>
            <button
              type="button"
              className="card exercise-card"
              onClick={() => {
                onOpen(exercise.id);
              }}
            >
              <span className="exercise-card-title">{exercise.title}</span>
              <span className="exercise-card-summary">{exercise.summary}</span>
              <span className="exercise-card-badges">
                <span className="badge">{DIFFICULTY_LABEL[exercise.difficulty]}</span>
                {reasons.map((reason) => (
                  <span key={reason} className="badge">
                    {reason}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
