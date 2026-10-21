import type { Exercise } from "../api/exercises";
import { Markdown } from "./Markdown";

/**
 * The statement, laid out as a structure rather than one block of text: what it is about, the
 * input and output formats side by side, then the traps in a callout, then the examples.
 */
export function ExerciseStatement({ exercise }: { exercise: Exercise }) {
  return (
    <div className="statement">
      <article className="card">
        <div className="prose">
          <Markdown>{exercise.statement}</Markdown>
        </div>

        <div className="spec">
          <section>
            <h3 className="label">Entrée</h3>
            <div className="prose">
              <Markdown>{exercise.input}</Markdown>
            </div>
          </section>
          <section>
            <h3 className="label">Sortie</h3>
            <div className="prose">
              <Markdown>{exercise.output}</Markdown>
            </div>
          </section>
        </div>

        {exercise.notes && (
          <aside className="callout">
            <h3 className="label">À savoir</h3>
            <div className="prose">
              <Markdown>{exercise.notes}</Markdown>
            </div>
          </aside>
        )}
      </article>

      <section className="card">
        <h3 className="label">Exemples</h3>
        {exercise.examples.map((example, position) => (
          <div key={example.input} className="example">
            <p className="example-title">Exemple {position + 1}</p>
            <div className="example-grid">
              <div>
                <h4 className="label">Entrée</h4>
                <pre className="snippet">{example.input || "(vide)"}</pre>
              </div>
              <div>
                <h4 className="label">Sortie</h4>
                <pre className="snippet">{example.output}</pre>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
