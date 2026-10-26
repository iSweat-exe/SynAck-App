import { call } from "./call";

/** How many days in a row the learner solved an exercise or validated a protocol. */
export function getStreak(): Promise<number> {
  return call<number>("get_streak");
}
