import { useEffect } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { Gain } from "../xp";
import { Burst } from "./Burst";
import { CountUp } from "./CountUp";
import { NavIcon } from "./NavIcon";
import { usePlayback } from "./usePlayback";

/**
 * The coins. When some are earned, the coin spins and bursts, the figure rolls up to its new value,
 * the counter swells for a moment and a label says how many were won.
 */
export function CoinCounter({
  coins,
  gain,
  onOpen,
}: {
  coins: number;
  gain: Gain | null;
  /** Opens the shop. */
  onOpen: () => void;
}) {
  const { shown, playback } = usePlayback(coins, gain, gain?.coins ?? 0);
  const swell = useAnimationControls();
  const spin = useAnimationControls();

  useEffect(() => {
    if (playback === null) return;
    void swell.start({ scale: [1, 1.08, 1], transition: { duration: 0.5, delay: 0.1 } });
    void spin.start({ rotateY: [0, 720], transition: { duration: 0.9, ease: "easeInOut" } });
  }, [playback, swell, spin]);

  return (
    <motion.button
      type="button"
      className="coins"
      animate={swell}
      title="Ouvrir la boutique"
      aria-label={`Ouvrir la boutique, ${String(coins)} pièces`}
      onClick={onOpen}
    >
      <span className="coins-icon">
        <motion.span className="coins-flip" style={{ transformPerspective: 300 }} animate={spin}>
          <NavIcon name="coin" />
        </motion.span>
        {playback !== null && <Burst key={playback.id} radius={22} />}
      </span>
      <CountUp value={shown} />
      {playback !== null && (
        <motion.span
          key={playback.id}
          className="badge badge-success gain-label tabular-nums"
          aria-hidden="true"
          style={{ x: "-50%" }}
          initial={{ opacity: 0, y: 4, scale: 0.8, filter: "blur(4px)" }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [4, 10, 10, 18],
            scale: [0.8, 1, 1, 1],
            filter: ["blur(4px)", "blur(0px)", "blur(0px)", "blur(0px)"],
          }}
          transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1], ease: "easeOut", delay: 0.1 }}
        >
          +<CountUp value={playback.amount} from={0} />
        </motion.span>
      )}
      <span className="visually-hidden" role="status">
        {playback === null ? "" : `${String(playback.amount)} pièces gagnées.`}
      </span>
    </motion.button>
  );
}
