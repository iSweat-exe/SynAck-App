import { motion } from "motion/react";

const DOTS = 8;

/**
 * A short burst of small dots from the middle of its parent, for a reward just earned. The parent
 * must be `position: relative`; the dots are drawn from its center. Mount it with a new key to
 * play it again.
 */
export function Burst({ radius = 24 }: { radius?: number }) {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: DOTS }, (_, index) => {
        const angle = (index / DOTS) * Math.PI * 2;
        return (
          <motion.span
            key={angle}
            className="burst-dot"
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius,
              scale: 0.3,
              opacity: 0,
            }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
          />
        );
      })}
    </span>
  );
}
