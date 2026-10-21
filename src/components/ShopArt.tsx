import type { Variants } from "motion/react";
import type { ShopArtId } from "../shop/catalog";
import { SPRITES, toRuns } from "../shop/sprites";
import { AnimatedSvg } from "./AnimatedSvg";

/**
 * A pixel of motion is one unit of the drawing. The pixel art moves in whole pixels, held then
 * jumping, like the animation of an old game: each value is kept for an equal share of the time.
 */
function hops(values: readonly number[]): { values: number[]; times: number[] } {
  const share = 1 / values.length;
  const held: number[] = [];
  const times: number[] = [];
  values.forEach((value, index) => {
    held.push(value, value);
    times.push(index * share, (index + 1) * share - 0.001);
  });
  times[times.length - 1] = 1;
  return { values: held, times };
}

const REST = { x: 0, y: 0, opacity: 1, transition: { duration: 0.1 } };

function hop(axis: "x" | "y", values: readonly number[], duration = 0.5): Variants {
  const { values: held, times } = hops(values);
  const transition = { duration, times, ease: "linear" } as const;
  return {
    rest: REST,
    hover: axis === "x" ? { x: held, transition } : { y: held, transition },
  };
}

/** What each drawing does when its card is hovered, in whole pixels. */
const STATES: Record<ShopArtId, Variants> = {
  "double-xp": hop("y", [0, -2, 0, -1, 0]),
  "double-coins": hop("y", [0, -2, 0, -1, 0]),
  freeze: hop("x", [0, -1, 1, -1, 1, 0]),
  hint: {
    rest: REST,
    hover: {
      opacity: [1, 1, 0.35, 0.35, 1, 1, 0.35, 0.35, 1],
      transition: { duration: 0.6, ease: "linear" },
    },
  },
  "theme-mint": hop("x", [0, 1, 2, 1, 0]),
  "theme-ocean": hop("x", [0, 1, 2, 1, 0]),
  "theme-sun": hop("x", [0, 1, 2, 1, 0]),
  frame: hop("y", [0, -1, -2, -1, 0]),
  title: hop("y", [0, -3, 0, -1, 0]),
};

/**
 * The drawing of a shop item, in two-tone pixel art. It plays when the card it sits in
 * (`data-icon-host`) is hovered.
 */
export function ShopArt({ art }: { art: ShopArtId }) {
  const sprite = SPRITES[art];
  const width = sprite[0]?.length ?? 0;

  return (
    <AnimatedSvg
      className="shop-art"
      states={STATES[art]}
      viewBox={`0 0 ${String(width)} ${String(sprite.length)}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {toRuns(sprite).map((run) => (
        <rect
          key={`${String(run.x)}-${String(run.y)}`}
          className={run.tone === "ink" ? "pixel-ink" : "pixel-paper"}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
        />
      ))}
    </AnimatedSvg>
  );
}
