import { addTransitionType, startTransition } from "react";

/**
 * Going deeper (list to detail) or back up. The page animates only when its update runs inside a
 * transition: a plain `setState` swaps the page without any animation.
 */
export type Direction = "nav-forward" | "nav-back";

/** Runs a page change as a transition, tagged with its direction when it has one. */
export function navigate(update: () => void, direction?: Direction): void {
  startTransition(() => {
    if (direction !== undefined) addTransitionType(direction);
    update();
  });
}
