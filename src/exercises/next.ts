import type { Exercise } from "../api/exercises";

/**
 * The exercise to suggest after `currentId`: the next unsolved one in the catalog order, going
 * round to the beginning if needed. `null` when every other exercise is solved.
 */
export function nextUnsolved(
  exercises: readonly Exercise[],
  solvedIds: ReadonlySet<string>,
  currentId: string,
): Exercise | null {
  const start = exercises.findIndex((exercise) => exercise.id === currentId);
  for (let step = 1; step < exercises.length; step++) {
    const candidate = exercises[(start + step) % exercises.length];
    if (candidate && candidate.id !== currentId && !solvedIds.has(candidate.id)) {
      return candidate;
    }
  }
  return null;
}
