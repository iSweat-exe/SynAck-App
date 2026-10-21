import { describe, expect, it } from "vitest";
import { HEADER_HEIGHT, ROW_HEIGHT, VIEW_WIDTH, labelFits, layoutDiagram } from "./layout";
import { buildTimeline } from "./timeline";
import type { Actor, Step } from "./types";

const ACTORS: Actor[] = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
];

const STEPS: Step[] = [
  { from: "a", to: "b", label: "Salut", note: "" },
  { from: "c", to: "a", label: "Retour", note: "" },
  { from: "a", to: "a", label: "Réfléchit", note: "" },
];

const layout = layoutDiagram(ACTORS, buildTimeline(STEPS, false));

describe("layoutDiagram", () => {
  it("spreads the actors evenly, the first and the last away from the edges", () => {
    const xs = layout.columns.map((column) => column.x);
    expect(xs[1]).toBeCloseTo((xs[0] ?? 0) + layout.spacing);
    expect(xs[2]).toBeCloseTo((xs[1] ?? 0) + layout.spacing);
    expect(xs[0]).toBeGreaterThan(0);
    expect(xs[2]).toBeLessThan(VIEW_WIDTH);
  });

  it("draws one row per step, one under the other", () => {
    expect(layout.rows.map((row) => row.y)).toEqual([
      HEADER_HEIGHT + ROW_HEIGHT / 2,
      HEADER_HEIGHT + ROW_HEIGHT * 1.5,
      HEADER_HEIGHT + ROW_HEIGHT * 2.5,
    ]);
  });

  it("makes the drawing tall enough for every step", () => {
    expect(layout.height).toBeGreaterThan(HEADER_HEIGHT + 3 * ROW_HEIGHT);
  });

  it("goes from the sender to the receiver, to the left as well as to the right", () => {
    const [toTheRight, toTheLeft] = layout.rows;
    expect((toTheRight?.x2 ?? 0) - (toTheRight?.x1 ?? 0)).toBeGreaterThan(0);
    expect((toTheLeft?.x2 ?? 0) - (toTheLeft?.x1 ?? 0)).toBeLessThan(0);
  });

  it("draws what an actor does alone on its own lifeline", () => {
    const alone = layout.rows[2];
    expect(alone?.local).toBe(true);
    expect(alone?.x1).toBe(alone?.x2);
  });

  it("keeps the box of a local step inside the drawing, even on the first column", () => {
    const first = layoutDiagram(
      ACTORS,
      buildTimeline(
        [{ from: "a", to: "a", label: "Un libellé assez long pour déborder", note: "" }],
        false,
      ),
    ).rows[0];
    expect(first?.box.x).toBeGreaterThanOrEqual(0);
    expect((first?.box.x ?? 0) + (first?.box.width ?? 0)).toBeLessThanOrEqual(VIEW_WIDTH);
  });

  it("treats the wait after a lost packet as something the sender does alone", () => {
    const lossy: Step[] = [
      { from: "a", to: "b", label: "Salut", note: "", loss: { lost: "", wait: "", retry: "" } },
    ];
    const rows = layoutDiagram(ACTORS, buildTimeline(lossy, true)).rows;
    expect(rows.map((row) => row.local)).toEqual([false, true, false]);
  });
});

describe("labelFits", () => {
  const [arrow] = layout.rows;

  it("accepts a label shorter than its arrow", () => {
    expect(arrow && labelFits(arrow, "Salut", layout.spacing)).toBe(true);
  });

  it("refuses a label longer than its arrow", () => {
    expect(arrow && labelFits(arrow, "x".repeat(60), layout.spacing)).toBe(false);
  });
});
