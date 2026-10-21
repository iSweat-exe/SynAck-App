import type { Difficulty } from "./api/exercises";

/** Experience for each thing finished once, whatever the language it was solved in. */
const XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 30 };

/** Coins for each thing finished once: half of the experience, so they stay a smaller figure. */
const COINS_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 5, medium: 10, hard: 15 };

/** What finishing one thing for the first time earns. */
export interface Reward {
  xp: number;
  coins: number;
}

export function rewardOf(difficulty: Difficulty): Reward {
  return { xp: XP_BY_DIFFICULTY[difficulty], coins: COINS_BY_DIFFICULTY[difficulty] };
}

/** A reward that was just earned, for the navbar to celebrate. The id tells one from the next. */
export interface Gain extends Reward {
  id: number;
}

/** The experience needed for each level. */
export const XP_PER_LEVEL = 100;

/** The experience earned by the exercises solved and the protocols validated, by difficulty. */
export function totalXp(finished: readonly Difficulty[]): number {
  return finished.reduce((sum, difficulty) => sum + XP_BY_DIFFICULTY[difficulty], 0);
}

/** The coins earned by the exercises solved and the protocols validated, by difficulty. */
export function totalCoins(finished: readonly Difficulty[]): number {
  return finished.reduce((sum, difficulty) => sum + COINS_BY_DIFFICULTY[difficulty], 0);
}

export interface Level {
  level: number;
  /** The experience earned in this level so far. */
  into: number;
  /** The experience this level asks for. */
  size: number;
}

/** The level reached with this much experience, and how far along the next one is. */
export function levelOf(xp: number): Level {
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    into: xp % XP_PER_LEVEL,
    size: XP_PER_LEVEL,
  };
}
