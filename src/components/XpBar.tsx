import { useEffect } from "react";
import {
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { levelOf, type Gain } from "../xp";
import { Burst } from "./Burst";
import { usePlayback } from "./usePlayback";

/**
 * The level, the way to the next one and the exact figure. When an exercise or a protocol earns
 * experience, the bar fills with a light sweeping over it, a label says how much was won, and a
 * new level makes the bar fill up, empty and start again, with the level bursting in.
 */
export function XpBar({ xp, gain }: { xp: number; gain: Gain | null }) {
  const { level, into, size } = levelOf(xp);
  const { shown, playback } = usePlayback(xp, gain, gain?.xp ?? 0);
  const fill = useMotionValue(levelOf(xp).into / size);
  const pulse = useAnimationControls();
  const reduceMotion = useReducedMotion() === true;

  const leveledUp = playback !== null && levelOf(playback.to).level > levelOf(playback.from).level;

  // With no celebration, the bar simply shows the total.
  useEffect(() => {
    const current = levelOf(shown);
    fill.set(current.into / current.size);
  }, [shown, fill]);

  useEffect(() => {
    if (playback === null) return;
    const from = levelOf(playback.from);
    const to = levelOf(playback.to);
    const start = from.into / from.size;
    const end = to.into / to.size;
    // Imperative animations are not covered by MotionConfig: someone who asked for less motion gets the total at once.
    if (reduceMotion) {
      fill.set(end);
      return;
    }
    const controls =
      to.level > from.level
        ? // Up to the top, back to the bottom while nobody looks, then up to where it stands.
          animate(fill, [start, 1, 0, end], {
            duration: 1.2,
            times: [0, 0.4, 0.46, 1],
            ease: "easeOut",
          })
        : animate(fill, [start, end], { duration: 0.8, delay: 0.1, ease: [0.2, 0, 0, 1] });
    void pulse.start({ scale: [1, 1.06, 1], transition: { duration: 0.5, delay: 0.1 } });
    return () => {
      controls.stop();
    };
  }, [playback, fill, pulse, reduceMotion]);

  return (
    <div
      className="xp"
      role="progressbar"
      aria-label={`Niveau ${String(level)}`}
      aria-valuemin={0}
      aria-valuemax={size}
      aria-valuenow={into}
      aria-valuetext={`${String(into)} sur ${String(size)} XP pour le niveau suivant`}
    >
      <span className="xp-level-wrap">
        <motion.span
          key={level}
          className="xp-level tabular-nums"
          initial={leveledUp ? { scale: 1.5, y: -4, opacity: 0.2 } : false}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0, delay: leveledUp ? 0.5 : 0 }}
        >
          Niv. {level}
        </motion.span>
        {leveledUp && <Burst key={playback.id} radius={28} />}
      </span>
      <motion.span className="xp-track" aria-hidden="true" animate={pulse}>
        <motion.span className="xp-fill" style={{ scaleX: fill }} />
        {playback !== null && (
          <motion.span
            key={playback.id}
            className="xp-shine"
            initial={{ x: "-120%" }}
            animate={{ x: "320%" }}
            transition={{ duration: 0.9, delay: 0.3, ease: "easeInOut" }}
          />
        )}
      </motion.span>
      <span className="xp-count tabular-nums">
        {into} / {size} XP
      </span>
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
          {leveledUp ? `Niveau ${String(level)} ! ` : ""}+{playback.amount} XP
        </motion.span>
      )}
      <span className="visually-hidden" role="status">
        {playback === null
          ? ""
          : `${leveledUp ? `Niveau ${String(level)} atteint. ` : ""}${String(playback.amount)} XP gagnés.`}
      </span>
    </div>
  );
}
