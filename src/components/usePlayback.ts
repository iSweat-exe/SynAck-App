import { useState } from "react";

/** One celebration to play: the figure goes from `from` to `to`, and `amount` was just earned. */
export interface Playback {
  id: number;
  from: number;
  to: number;
  amount: number;
}

/**
 * Tells the navbar when to celebrate. The reward event arrives first and the new total a moment
 * later (the progress is read again after it), so a celebration starts when a total goes up while
 * an event is waiting. A total that changes with no event, such as the first read at launch, is
 * shown at once and never celebrated.
 *
 * `shown` is the total the figure currently stands for; `playback` is the celebration to play.
 */
export function usePlayback(
  total: number,
  event: { id: number } | null,
  amount: number,
): { shown: number; playback: Playback | null } {
  const [shown, setShown] = useState(total);
  const [playback, setPlayback] = useState<Playback | null>(null);

  // Derived while rendering, not in an effect: React re-renders at once with the new values.
  if (total !== shown) {
    setShown(total);
    if (event !== null && event.id !== playback?.id && total > shown && amount > 0) {
      setPlayback({ id: event.id, from: shown, to: total, amount });
    }
  }

  return { shown, playback };
}
