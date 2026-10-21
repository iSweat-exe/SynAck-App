import type { TimelineStep } from "./timeline";
import type { Actor } from "./types";

/** All the sizes are in the units of the SVG (its `viewBox`); the drawing scales to the window. */
export const VIEW_WIDTH = 880;
export const HEADER_HEIGHT = 104;
export const ROW_HEIGHT = 62;
const MARGIN_X = 90;
const BOTTOM = 24;
/** The width of one character of the labels (Space Mono at 16 units). */
export const CHAR_WIDTH = 9.8;
const LABEL_PADDING = 16;
const BOX_PADDING = 24;
const EDGE = 4;

export interface Column {
  id: string;
  x: number;
}

export interface Row {
  /** The vertical position of the arrow (or of the middle of the box). */
  y: number;
  x1: number;
  x2: number;
  /** Something an actor does alone: drawn as a box on its lifeline, not as an arrow. */
  local: boolean;
  /** The box of a local step, moved inward if it would leave the drawing. */
  box: { x: number; width: number };
}

export interface Layout {
  width: number;
  height: number;
  columns: Column[];
  rows: Row[];
  /** The distance between two neighbor lifelines. */
  spacing: number;
}

export function layoutDiagram(actors: readonly Actor[], timeline: readonly TimelineStep[]): Layout {
  const spacing = actors.length > 1 ? (VIEW_WIDTH - 2 * MARGIN_X) / (actors.length - 1) : 0;
  const columns = actors.map((actor, index) => ({ id: actor.id, x: MARGIN_X + index * spacing }));
  const xOf = (id: string) => columns.find((column) => column.id === id)?.x ?? MARGIN_X;

  const rows = timeline.map((step, index): Row => {
    const x1 = xOf(step.from);
    const x2 = xOf(step.to);
    const local = step.kind === "local" || step.kind === "wait";
    const width = boxWidth(step.label);
    const centered = Math.max(EDGE, Math.min(x1 - width / 2, VIEW_WIDTH - EDGE - width));
    return {
      y: HEADER_HEIGHT + ROW_HEIGHT / 2 + index * ROW_HEIGHT,
      x1,
      x2: local ? x1 : x2,
      local,
      box: { x: centered, width },
    };
  });

  return {
    width: VIEW_WIDTH,
    height: HEADER_HEIGHT + timeline.length * ROW_HEIGHT + BOTTOM,
    columns,
    rows,
    spacing,
  };
}

function boxWidth(label: string): number {
  return label.length * CHAR_WIDTH + 2 * BOX_PADDING;
}

/** Whether the label of a step fits where it is written: on its arrow, or in its box. */
export function labelFits(row: Row, label: string, spacing: number): boolean {
  if (row.local) return boxWidth(label) / 2 < spacing;
  return label.length * CHAR_WIDTH + 2 * LABEL_PADDING <= Math.abs(row.x2 - row.x1);
}
