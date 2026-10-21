import { findProtocol } from "../protocols/catalog";
import type { Protocol } from "../protocols/types";
import { CheckIcon } from "./CheckIcon";
import { LessonCard } from "./LessonCard";
import { Prerequisites } from "./Prerequisites";
import { ProtocolPlayer } from "./ProtocolPlayer";
import { ProtocolQuiz } from "./ProtocolQuiz";

interface ProtocolPageProps {
  protocol: Protocol;
  validated: boolean;
  /** The protocols validated so far: a prerequisite already validated is ticked. */
  validatedIds: ReadonlySet<string>;
  onValidated: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
}

/** One protocol: the animated diagram, what to remember, then the quiz that validates it. */
export function ProtocolPage({
  protocol,
  validated,
  validatedIds,
  onValidated,
  onOpen,
  onBack,
}: ProtocolPageProps) {
  const related = protocol.related.flatMap((id) => findProtocol(id) ?? []);

  return (
    <article className="protocol">
      <header className="protocol-header">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Tous les protocoles
        </button>
        <h3 className="protocol-title">
          {protocol.name} <span className="protocol-full">{protocol.fullName}</span>
          {validated && (
            <span className="badge badge-success">
              <CheckIcon />
              Validé
            </span>
          )}
        </h3>
        <p className="protocol-tagline">{protocol.tagline}</p>
        <Prerequisites protocol={protocol} validatedIds={validatedIds} onOpen={onOpen} />
      </header>

      <section aria-labelledby="protocol-diagram" className="protocol-diagram">
        <h4 className="label" id="protocol-diagram">
          Pas à pas
        </h4>
        <ProtocolPlayer protocol={protocol} />
      </section>

      <section className="protocol-purpose" aria-labelledby="protocol-purpose">
        <h4 className="label" id="protocol-purpose">
          À quoi ça sert
        </h4>
        {protocol.purpose.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      <section aria-labelledby="protocol-lessons" className="protocol-lessons">
        <h4 className="label" id="protocol-lessons">
          Le cours en détail
        </h4>
        <p className="protocol-lessons-intro">
          Tout ce que demande le quiz est dit ici. Lis chaque leçon, puis valide le protocole.
        </p>
        <div className="lesson-grid">
          {protocol.lessons.map((lesson) => (
            <LessonCard
              key={`${lesson.subject}-${String(lesson.steps !== undefined)}`}
              lesson={lesson}
            />
          ))}
        </div>
      </section>

      <div className="protocol-summary">
        <section className="card" aria-labelledby="protocol-takeaways">
          <h4 className="label" id="protocol-takeaways">
            À retenir
          </h4>
          <ul>
            {protocol.takeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ul>
        </section>
        <section className="card" aria-labelledby="protocol-facts">
          <h4 className="label" id="protocol-facts">
            En bref
          </h4>
          <dl className="protocol-facts">
            {protocol.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="protocol-quiz" className="protocol-quiz">
        <h4 className="label" id="protocol-quiz">
          Valider ce protocole
        </h4>
        <ProtocolQuiz
          protocol={protocol.id}
          validated={validated}
          onValidated={onValidated}
          onBack={onBack}
        />
      </section>

      {related.length > 0 && (
        <section className="protocol-related" aria-labelledby="protocol-related">
          <h4 className="label" id="protocol-related">
            À lire ensuite
          </h4>
          <div className="chips">
            {related.map((next) => (
              <button
                key={next.id}
                type="button"
                className="chip"
                onClick={() => {
                  onOpen(next.id);
                }}
              >
                {next.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
