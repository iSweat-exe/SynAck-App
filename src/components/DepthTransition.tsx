import { ViewTransition, type ReactNode } from "react";

/**
 * Wraps a page that sits one level deeper than another (a list and its detail): going forward the
 * new page slides in from the right, going back it slides in from the left. The caller keys it, so
 * that each page is its own transition, and changes page with `navigate(..., direction)`.
 */
export function DepthTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      default="none"
      enter={{ "nav-forward": "depth-in-forward", "nav-back": "depth-in-back", default: "none" }}
      exit={{ "nav-forward": "depth-out-forward", "nav-back": "depth-out-back", default: "none" }}
    >
      {children}
    </ViewTransition>
  );
}
