import { useEffect, useRef, type ComponentProps } from "react";
import { motion, useAnimationControls, type Variants } from "motion/react";

type AnimatedSvgProps = Omit<
  ComponentProps<typeof motion.svg>,
  "variants" | "animate" | "initial" | "ref"
> & {
  /** What the icon does: a `rest` state, and a `hover` one that plays when its button is hovered. */
  states: Variants;
};

/**
 * An icon that plays its `hover` animation when the button, link or label around it is hovered, so
 * that no button has to know about its icon. Nothing plays on a disabled button.
 */
export function AnimatedSvg({ states, children, ...svgProps }: AnimatedSvgProps) {
  const ref = useRef<SVGSVGElement>(null);
  const controls = useAnimationControls();

  useEffect(() => {
    const host = ref.current?.closest("button, a, label, [data-icon-host]");
    if (!host) return;
    const enter = () => {
      if (host instanceof HTMLButtonElement && host.disabled) return;
      void controls.start("hover");
    };
    const leave = () => {
      void controls.start("rest");
    };
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
    };
  }, [controls]);

  return (
    <motion.svg ref={ref} variants={states} initial="rest" animate={controls} {...svgProps}>
      {children}
    </motion.svg>
  );
}
