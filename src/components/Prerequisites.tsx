import { findProtocol } from "../protocols/catalog";
import type { Protocol } from "../protocols/types";
import { CheckIcon } from "./CheckIcon";

interface PrerequisitesProps {
  protocol: Protocol;
  validatedIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
}

/**
 * What to know before starting, right under the title: the protocols to read first (one press
 * opens them, a tick says it is already validated) and the notions that are not in the course.
 */
export function Prerequisites({ protocol, validatedIds, onOpen }: PrerequisitesProps) {
  const required = protocol.prerequisites.flatMap((id) => findProtocol(id) ?? []);
  const none = required.length === 0 && protocol.notions.length === 0;

  return (
    <aside className="prerequisites" aria-label="Prérequis">
      <p className="label">Avant de commencer</p>
      {none ? (
        <p className="prerequisites-none">Aucun prérequis : tu peux commencer ici.</p>
      ) : (
        <ul className="prerequisites-list">
          {required.map((item) => {
            const done = validatedIds.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="chip prerequisite"
                  data-done={done}
                  aria-label={`${item.name}, protocole à connaître${done ? ", déjà validé" : ""}`}
                  onClick={() => {
                    onOpen(item.id);
                  }}
                >
                  {done && <CheckIcon />}
                  {item.name}
                </button>
              </li>
            );
          })}
          {protocol.notions.map((notion) => (
            <li key={notion}>
              <span className="prerequisite-notion">{notion}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
