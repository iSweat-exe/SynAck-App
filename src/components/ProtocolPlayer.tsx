import { useEffect, useMemo, useReducer, useState } from "react";
import { initialPlayer, playerReducer } from "../protocols/player";
import { buildTimeline, hasLoss } from "../protocols/timeline";
import type { Protocol } from "../protocols/types";
import { SequenceDiagram } from "./SequenceDiagram";

/** How long a step stays on screen when the animation plays by itself. */
const STEP_MS = 3200;

const KIND_LABEL = {
  message: "Message",
  local: "Action locale",
  lost: "Message perdu",
  wait: "Attente",
} as const;

/** Someone who asked their system for less motion gets a diagram that waits for them. */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The diagram of a protocol and its controls. It plays by itself, one step at a time, and the
 * learner can pause, go step by step, jump to a step, or ask for a packet to be lost.
 */
export function ProtocolPlayer({ protocol }: { protocol: Protocol }) {
  const [simulateLoss, setSimulateLoss] = useState(false);
  const timeline = useMemo(
    () => buildTimeline(protocol.steps, simulateLoss),
    [protocol.steps, simulateLoss],
  );
  const [player, dispatch] = useReducer(playerReducer, undefined, () =>
    initialPlayer(!prefersReducedMotion()),
  );
  const last = timeline.length - 1;
  const atEnd = player.current === last;
  const step = timeline[player.current];

  useEffect(() => {
    if (!player.playing) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "next", last });
    }, STEP_MS);
    return () => {
      window.clearTimeout(timer);
    };
    // `step` changes with every step: the timer starts again for each one.
  }, [player.playing, step, last]);

  if (!step) return null;

  return (
    <div className="player">
      <div className="player-bar">
        <div className="button-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={player.current === 0}
            onClick={() => {
              dispatch({ type: "previous" });
            }}
          >
            Précédent
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (player.playing) dispatch({ type: "pause" });
              else if (atEnd) dispatch({ type: "restart" });
              else dispatch({ type: "play" });
            }}
          >
            {player.playing ? "Pause" : atEnd ? "Rejouer" : "Lecture"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={atEnd}
            onClick={() => {
              dispatch({ type: "next", last });
              dispatch({ type: "pause" });
            }}
          >
            Suivant
          </button>
        </div>
        {hasLoss(protocol.steps) && (
          <button
            type="button"
            className="chip"
            aria-pressed={simulateLoss}
            onClick={() => {
              setSimulateLoss(!simulateLoss);
              dispatch({ type: "restart" });
            }}
          >
            Simuler une perte de paquet
          </button>
        )}
        <nav className="player-steps" aria-label="Étapes">
          <ol>
            {timeline.map((entry, index) => (
              <li key={`${String(index)}-${entry.label}`}>
                <button
                  type="button"
                  className="player-step tabular-nums"
                  title={entry.label}
                  aria-label={`Étape ${String(index + 1)} : ${entry.label}`}
                  aria-current={index === player.current ? "step" : undefined}
                  data-future={index > player.current ? "true" : undefined}
                  onClick={() => {
                    dispatch({ type: "goto", index, last });
                  }}
                >
                  {index + 1}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="player-body">
        <div className="card player-diagram">
          <SequenceDiagram
            actors={protocol.actors}
            timeline={timeline}
            current={player.current}
            run={player.run}
          />
        </div>

        <article
          className="card player-note"
          aria-live="polite"
          key={`${String(player.run)}-${String(player.current)}`}
        >
          <p className="label">
            <span className="tabular-nums">
              Étape {player.current + 1} sur {timeline.length}
            </span>
            {" : "}
            {KIND_LABEL[step.kind]}
          </p>
          <h4 className="player-note-title">{step.label}</h4>
          <p>{step.note}</p>
          {step.detail !== undefined && <pre className="snippet">{step.detail}</pre>}
        </article>
      </div>
    </div>
  );
}
