import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/**
 * A figure that rolls to its value instead of jumping: from the previous value when it changes, and
 * from `from` when it first appears. Equal-width digits: no layout shift. Someone who asked for less
 * motion gets the figure at once.
 */
export function CountUp({ value, from }: { value: number; from?: number }) {
  const count = useMotionValue(from ?? value);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion === true) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.9, ease: [0.2, 0, 0, 1] });
    return () => {
      controls.stop();
    };
  }, [count, value, reduceMotion]);

  return <motion.span className="tabular-nums">{rounded}</motion.span>;
}
