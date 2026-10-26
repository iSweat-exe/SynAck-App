import { useEffect, useState } from "react";
import { getStreak } from "../api/streak";

/**
 * The learner's streak, in days. It is computed by the Rust side from the dates of the progress, so
 * it is read again whenever the amount of progress changes (`progressCount`).
 */
export function useStreak(progressCount: number): number {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStreak()
      .then((days) => {
        if (!cancelled) setStreak(days);
      })
      .catch(() => {
        // The streak is a comfort: if it cannot be read, the last known value stays.
      });
    return () => {
      cancelled = true;
    };
  }, [progressCount]);

  return streak;
}
