import { motion, useReducedMotion } from "motion/react";

interface CheckIconProps {
  strokeWidth?: number;
  /** Draws the mark stroke by stroke. Only for the rare, earned moments, never in lists. */
  draw?: boolean;
}

/** A check mark. Drawn with `currentColor` so the surrounding text color decides its color. */
export function CheckIcon({ strokeWidth = 2, draw = false }: CheckIconProps) {
  const path = "M5 12.5l4.5 4.5L19 7.5";
  // Someone who asked for less motion sees the mark at once, already drawn.
  const reduceMotion = useReducedMotion();
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {draw && reduceMotion !== true ? (
        <motion.path
          d={path}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.25, ease: [0.2, 0, 0, 1] }}
        />
      ) : (
        <path d={path} />
      )}
    </svg>
  );
}
