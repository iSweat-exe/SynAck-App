import { DIFFICULTY_LABEL } from "../exercises/labels";
import { findProtocol } from "../protocols/catalog";
import type { Protocol } from "../protocols/types";
import { CheckIcon } from "./CheckIcon";

/** The prerequisites in a few words, for a card. */
function prerequisiteLine(protocol: Protocol): string {
  const names = protocol.prerequisites.flatMap((id) => findProtocol(id)?.name ?? []);
  if (names.length === 0 && protocol.notions.length === 0) return "Aucun prérequis";
  const notions =
    protocol.notions.length === 0 ? [] : [`${String(protocol.notions.length)} notion de base`];
  return `Avant : ${[...names, ...notions].join(", ")}`;
}

interface ProtocolListProps {
  protocols: readonly Protocol[];
  validated: ReadonlySet<string>;
  onOpen: (id: string) => void;
  /** Shown when the filters leave nothing. */
  onReset: () => void;
}

/** The protocols as cards, like the exercises: a validated one is green and its name is struck. */
export function ProtocolList({ protocols, validated, onOpen, onReset }: ProtocolListProps) {
  if (protocols.length === 0) {
    return (
      <div className="empty card">
        <p>Aucun protocole ne correspond à ces filtres.</p>
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Réinitialiser les filtres
        </button>
      </div>
    );
  }

  return (
    <ul className="exercise-grid">
      {protocols.map((protocol) => {
        const isValidated = validated.has(protocol.id);
        return (
          <li key={protocol.id}>
            <button
              type="button"
              className="card exercise-card"
              data-solved={isValidated}
              onClick={() => {
                onOpen(protocol.id);
              }}
            >
              <span className="exercise-card-title">{protocol.name}</span>
              <span className="exercise-card-summary">{protocol.tagline}</span>
              <span className="exercise-card-topics">{protocol.topics.join(", ")}</span>
              <span className="exercise-card-topics">{prerequisiteLine(protocol)}</span>
              <span className="exercise-card-badges">
                <span className="badge">{DIFFICULTY_LABEL[protocol.difficulty]}</span>
                {isValidated ? (
                  <span className="badge badge-success">
                    <CheckIcon />
                    Validé
                  </span>
                ) : (
                  <span className="badge">Quiz à réussir</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
