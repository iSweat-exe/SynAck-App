import { describe, expect, it } from "vitest";
import { buildTimeline, hasLoss, statesAt } from "./timeline";
import type { Actor, Step } from "./types";

const ACTORS: Actor[] = [
  { id: "a", name: "A", state: "CLOSED" },
  { id: "b", name: "B" },
];

const STEPS: Step[] = [
  { from: "a", to: "b", label: "SYN", note: "n1", states: { a: "SYN_SENT" } },
  { from: "b", to: "b", label: "Calcule", note: "n2", tone: "warning" },
  {
    from: "a",
    to: "b",
    label: "Données",
    note: "n3",
    detail: "DATA",
    states: { b: "ESTABLISHED" },
    loss: { lost: "perdu", wait: "attente", retry: "renvoi" },
  },
];

describe("hasLoss", () => {
  it("is true when a step can be lost", () => {
    expect(hasLoss(STEPS)).toBe(true);
  });

  it("is false when no step can be lost", () => {
    expect(hasLoss(STEPS.slice(0, 2))).toBe(false);
  });
});

describe("buildTimeline", () => {
  it("keeps the steps as they are when no loss is simulated", () => {
    expect(buildTimeline(STEPS, false).map((step) => step.label)).toEqual([
      "SYN",
      "Calcule",
      "Données",
    ]);
  });

  it("tells a message from something an actor does alone", () => {
    expect(buildTimeline(STEPS, false).map((step) => step.kind)).toEqual([
      "message",
      "local",
      "message",
    ]);
  });

  it("gives every step a tone, neutral by default", () => {
    expect(buildTimeline(STEPS, false).map((step) => step.tone)).toEqual([
      "neutral",
      "warning",
      "neutral",
    ]);
  });

  it("turns a step that can be lost into three when a loss is simulated", () => {
    const timeline = buildTimeline(STEPS, true);
    expect(timeline.map((step) => step.kind)).toEqual([
      "message",
      "local",
      "lost",
      "wait",
      "message",
    ]);
  });

  it("explains each of the three moments with the notes of the loss", () => {
    const [, , lost, wait, retry] = buildTimeline(STEPS, true);
    expect([lost?.note, wait?.note, retry?.note]).toEqual(["perdu", "attente", "renvoi"]);
  });

  it("marks the lost message in danger and the wait as a warning", () => {
    const [, , lost, wait] = buildTimeline(STEPS, true);
    expect([lost?.tone, wait?.tone]).toEqual(["danger", "warning"]);
  });

  it("labels the repeated message as a resend, and keeps its effect on the actors", () => {
    const retry = buildTimeline(STEPS, true)[4];
    expect(retry?.label).toBe("Données (renvoi)");
    expect(retry?.states).toEqual({ b: "ESTABLISHED" });
  });

  it("changes nothing for the steps that cannot be lost", () => {
    expect(buildTimeline(STEPS.slice(0, 2), true)).toEqual(buildTimeline(STEPS.slice(0, 2), false));
  });
});

describe("statesAt", () => {
  const timeline = buildTimeline(STEPS, false);

  it("starts from the initial state of each actor", () => {
    expect(statesAt(ACTORS, timeline, -1)).toEqual({ a: "CLOSED" });
  });

  it("applies the states of the steps already played", () => {
    expect(statesAt(ACTORS, timeline, 0)).toEqual({ a: "SYN_SENT" });
  });

  it("accumulates the states of several steps", () => {
    expect(statesAt(ACTORS, timeline, 2)).toEqual({ a: "SYN_SENT", b: "ESTABLISHED" });
  });
});
