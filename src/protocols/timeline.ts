import type { Actor, Step, Tone } from "./types";

/**
 * What the diagram really draws. It is the steps of a protocol, except that a packet loss turns
 * one step into three: the message is lost, the sender waits, the message is sent again.
 */
export type TimelineKind = "message" | "local" | "lost" | "wait";

export interface TimelineStep {
  kind: TimelineKind;
  from: string;
  to: string;
  label: string;
  note: string;
  detail?: string;
  tone: Tone;
  states?: Record<string, string>;
}

/** True when at least one step can be lost: only then is the loss switch worth showing. */
export function hasLoss(steps: readonly Step[]): boolean {
  return steps.some((step) => step.loss !== undefined);
}

export function buildTimeline(steps: readonly Step[], simulateLoss: boolean): TimelineStep[] {
  return steps.flatMap((step): TimelineStep[] => {
    const tone = step.tone ?? "neutral";
    const normal: TimelineStep = {
      kind: step.from === step.to ? "local" : "message",
      from: step.from,
      to: step.to,
      label: step.label,
      note: step.note,
      tone,
      ...(step.detail !== undefined && { detail: step.detail }),
      ...(step.states !== undefined && { states: step.states }),
    };

    if (!simulateLoss || !step.loss) return [normal];

    return [
      {
        kind: "lost",
        from: step.from,
        to: step.to,
        label: step.label,
        note: step.loss.lost,
        tone: "danger",
        ...(step.detail !== undefined && { detail: step.detail }),
      },
      {
        kind: "wait",
        from: step.from,
        to: step.to,
        label: "Délai dépassé",
        note: step.loss.wait,
        tone: "warning",
      },
      { ...normal, label: `${step.label} (renvoi)`, note: step.loss.retry },
    ];
  });
}

/** The state of every actor once the step at `index` is done. */
export function statesAt(
  actors: readonly Actor[],
  timeline: readonly TimelineStep[],
  index: number,
): Record<string, string> {
  const states: Record<string, string> = {};
  for (const actor of actors) {
    if (actor.state !== undefined) states[actor.id] = actor.state;
  }
  for (const step of timeline.slice(0, index + 1)) {
    Object.assign(states, step.states);
  }
  return states;
}
