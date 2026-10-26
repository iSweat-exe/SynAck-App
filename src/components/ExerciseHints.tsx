import { Markdown } from "./Markdown";

interface ExerciseHintsProps {
  /** The hints, from the lightest to the most precise. */
  hints: readonly string[];
  /** How many are shown. The rest stay hidden until the learner asks. */
  shown: number;
  onReveal: () => void;
}

/**
 * The hints of an exercise, one at a time: a stuck learner asks for the next one and gets a bit
 * more help, never the whole answer at once.
 */
export function ExerciseHints({ hints, shown, onReveal }: ExerciseHintsProps) {
  if (hints.length === 0) return null;
  const visible = Math.min(shown, hints.length);
  const remaining = hints.length - visible;

  return (
    <section className="card hints" aria-label="Indices">
      <h3 className="label">Indices</h3>
      {visible === 0 && (
        <p className="hints-intro">
          Bloqué ? Il y a {hints.length} indices, du plus léger au plus précis. Essaie d&apos;abord
          seul : tu les verras un par un.
        </p>
      )}
      {visible > 0 && (
        <ol className="hints-list">
          {hints.slice(0, visible).map((hint, position) => (
            <li key={hint} className="hint" aria-live="polite">
              <span className="badge">
                Indice {position + 1} sur {hints.length}
              </span>
              <div className="prose">
                <Markdown>{hint}</Markdown>
              </div>
            </li>
          ))}
        </ol>
      )}
      {remaining > 0 ? (
        <div>
          <button type="button" className="btn btn-secondary" onClick={onReveal}>
            {visible === 0 ? "Voir un indice" : `Voir l'indice ${String(visible + 1)}`}
          </button>
        </div>
      ) : (
        <p className="hints-intro">Tous les indices sont affichés.</p>
      )}
    </section>
  );
}
