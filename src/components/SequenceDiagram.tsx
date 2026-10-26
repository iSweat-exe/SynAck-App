import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HEADER_HEIGHT, layoutDiagram, type Row } from "../protocols/layout";
import { statesAt, type TimelineStep } from "../protocols/timeline";
import type { Actor } from "../protocols/types";

interface SequenceDiagramProps {
  actors: readonly Actor[];
  timeline: readonly TimelineStep[];
  /** The step being shown. Those before it are drawn still, it is drawn with its animation. */
  current: number;
  /** Changes when the learner restarts or jumps, so that the animation plays again. */
  run: number;
}

const ARROW = 9;
const LOST_AT = 0.55;
const EASE = [0.2, 0, 0, 1] as const;
// The head and the label appear once the line has nearly reached them.
const APPEAR = { duration: 0.3, delay: 0.55, ease: EASE };

/** The diagram as text, for those who do not see it. */
function describe(actors: readonly Actor[], timeline: readonly TimelineStep[], current: number) {
  const names = actors.map((actor) => actor.name).join(", ");
  return `Schéma entre ${names}. Étape ${String(current + 1)} sur ${String(timeline.length)}.`;
}

/**
 * `plays` is fixed when the row is mounted: a row that was the current step keeps animating to the
 * end even after the learner moves on, instead of being cut short and jumping to its final state.
 */
function Arrow({ row, step, plays }: { row: Row; step: TimelineStep; plays: boolean }) {
  const direction = Math.sign(row.x2 - row.x1);
  const lost = step.kind === "lost";
  const reach = lost ? row.x1 + (row.x2 - row.x1) * LOST_AT : row.x2;
  // The line stops at the head of the arrow, so that its end is not wider than the tip.
  const lineEnd = lost ? reach : reach - direction * ARROW;
  const labelX = (row.x1 + row.x2) / 2;
  const fadeIn = plays
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: APPEAR }
    : {};

  return (
    <>
      <motion.line
        className="seq-line"
        x1={row.x1}
        y1={row.y}
        x2={lineEnd}
        y2={row.y}
        initial={plays ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      {lost ? (
        <motion.path
          className="seq-cross"
          d={`M ${String(reach - 7)} ${String(row.y - 7)} l 14 14 m 0 -14 l -14 14`}
          {...fadeIn}
        />
      ) : (
        <motion.polygon
          className="seq-head"
          points={`${String(row.x2)},${String(row.y)} ${String(row.x2 - direction * ARROW)},${String(row.y - 5)} ${String(row.x2 - direction * ARROW)},${String(row.y + 5)}`}
          {...fadeIn}
        />
      )}
      <motion.text className="seq-label" x={labelX} y={row.y - 11} textAnchor="middle" {...fadeIn}>
        {step.label}
      </motion.text>
      {plays && (
        <motion.circle
          className="seq-packet"
          cx={row.x1}
          cy={row.y}
          r={6}
          initial={{ x: 0, opacity: 1 }}
          animate={{ x: reach - row.x1, opacity: [1, 1, 0] }}
          transition={{ duration: 0.7, ease: EASE, opacity: { duration: 0.7, times: [0, 0.8, 1] } }}
        />
      )}
    </>
  );
}

function LocalBox({ row, step, plays }: { row: Row; step: TimelineStep; plays: boolean }) {
  return (
    <motion.g
      className={step.kind === "wait" ? "seq-box seq-box-wait" : "seq-box"}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      initial={plays ? { opacity: 0, scale: 0.25, filter: "blur(4px)" } : false}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <rect x={row.box.x} y={row.y - 20} width={row.box.width} height={40} rx={8} />
      <text
        className="seq-label"
        x={row.box.x + row.box.width / 2}
        y={row.y + 5}
        textAnchor="middle"
      >
        {step.label}
      </text>
    </motion.g>
  );
}

/** One played step. It remembers whether it was the current one when it appeared. */
function StepRow({
  row,
  step,
  isCurrent,
  layoutWidth,
}: {
  row: Row;
  step: TimelineStep;
  isCurrent: boolean;
  layoutWidth: number;
}) {
  const reduceMotion = useReducedMotion();
  const [plays] = useState(isCurrent && reduceMotion !== true);
  return (
    <g
      className={`seq-row seq-tone-${step.tone}${isCurrent ? " seq-row-current" : ""}`}
      aria-current={isCurrent ? "step" : undefined}
    >
      {isCurrent && (
        <rect className="seq-band" x={0} y={row.y - 30} width={layoutWidth} height={60} />
      )}
      {row.local ? (
        <LocalBox row={row} step={step} plays={plays} />
      ) : (
        <Arrow row={row} step={step} plays={plays} />
      )}
    </g>
  );
}

/**
 * A sequence diagram: one column per actor, one row per step, drawn in order from the top.
 * Only the steps already played are shown, so the drawing builds itself as the explanation goes.
 */
export function SequenceDiagram({ actors, timeline, current, run }: SequenceDiagramProps) {
  const layout = layoutDiagram(actors, timeline);
  const states = statesAt(actors, timeline, current);
  const actorWidth = Math.min(172, layout.spacing - 12);

  return (
    <svg
      className="seq"
      viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
      role="img"
      aria-label={describe(actors, timeline, current)}
    >
      {layout.columns.map((column, index) => {
        const actor = actors[index];
        if (!actor) return null;
        const state = states[actor.id];
        return (
          <g key={actor.id}>
            <line
              className="seq-lifeline"
              x1={column.x}
              y1={HEADER_HEIGHT - 14}
              x2={column.x}
              y2={layout.height - 8}
            />
            <rect
              className="seq-actor"
              x={column.x - actorWidth / 2}
              y={6}
              width={actorWidth}
              height={58}
              rx={8}
            />
            <text className="seq-actor-name" x={column.x} y={31} textAnchor="middle">
              {actor.name}
            </text>
            {actor.role !== undefined && (
              <text className="seq-actor-role" x={column.x} y={50} textAnchor="middle">
                {actor.role}
              </text>
            )}
            {state !== undefined && (
              <g key={state} className="seq-state">
                <rect
                  x={column.x - (state.length * 8.7 + 22) / 2}
                  y={68}
                  width={state.length * 8.7 + 22}
                  height={26}
                  rx={13}
                />
                <text x={column.x} y={86} textAnchor="middle">
                  {state}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {timeline.slice(0, current + 1).map((step, index) => {
        const row = layout.rows[index];
        if (!row) return null;
        return (
          <StepRow
            // The run is part of the key: restarting remounts the row, so its animation plays again.
            key={`${String(run)}-${String(index)}-${step.label}`}
            row={row}
            step={step}
            isCurrent={index === current}
            layoutWidth={layout.width}
          />
        );
      })}
    </svg>
  );
}
