import type { Difficulty, Exercise } from "../api/exercises";

/** What the filter panel needs to know about an item of a catalog (an exercise, a protocol). */
export interface Browsable {
  id: string;
  title: string;
  summary: string;
  topics: readonly string[];
  difficulty: Difficulty;
}

export type Status = "all" | "solved" | "todo" | "progress";

/** What the learner asked for in the filter panel. An empty group means "no restriction". */
export interface Criteria {
  query: string;
  difficulties: Difficulty[];
  languages: string[];
  topics: string[];
  status: Status;
}

export const NO_FILTER: Criteria = {
  query: "",
  difficulties: [],
  languages: [],
  topics: [],
  status: "all",
};

/** True when at least one criterion narrows the list. */
export function isFiltering(criteria: Criteria): boolean {
  return (
    criteria.query.trim() !== "" ||
    criteria.difficulties.length > 0 ||
    criteria.languages.length > 0 ||
    criteria.topics.length > 0 ||
    criteria.status !== "all"
  );
}

/** Lower case and without accents, so "fibonacci" finds "Fibonacci" and "dictionnaire" finds "dictionnaire". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchesQuery(item: Browsable, query: string): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText([item.title, item.summary, ...item.topics].join(" "));
  // Every word must appear somewhere: "liste ajouter" narrows, it does not widen.
  return words.every((word) => haystack.includes(word));
}

/** Inside a group the choices are alternatives (any); between groups they all must hold. */
function matchesAny(selected: readonly string[], offered: readonly string[]): boolean {
  return selected.length === 0 || selected.some((value) => offered.includes(value));
}

function matchesStatus(status: Status, done: boolean, inProgress: boolean): boolean {
  switch (status) {
    case "all":
      return true;
    case "solved":
      return done;
    case "todo":
      return !done;
    case "progress":
      return !done && inProgress;
  }
}

const NONE: ReadonlySet<string> = new Set();

/**
 * Keeps the items matching every criterion.
 *
 * @param doneIds ids of the items done (an exercise solved, a protocol validated)
 * @param languagesOf the languages an item is offered in; none by default
 * @param inProgressIds ids of the items started and not done; none by default
 */
export function filterItems<Item extends Browsable>(
  items: readonly Item[],
  doneIds: ReadonlySet<string>,
  criteria: Criteria,
  languagesOf: (item: Item) => readonly string[] = () => [],
  inProgressIds: ReadonlySet<string> = NONE,
): Item[] {
  return items.filter((item) => {
    const done = doneIds.has(item.id);
    return (
      matchesQuery(item, criteria.query) &&
      matchesAny(criteria.difficulties, [item.difficulty]) &&
      matchesAny(criteria.languages, languagesOf(item)) &&
      matchesAny(criteria.topics, item.topics) &&
      matchesStatus(criteria.status, done, inProgressIds.has(item.id))
    );
  });
}

/**
 * Keeps the exercises matching every criterion.
 *
 * @param solvedIds ids of the exercises solved in at least one language
 * @param inProgressIds ids of the exercises started and not solved
 */
export function filterExercises(
  exercises: readonly Exercise[],
  solvedIds: ReadonlySet<string>,
  criteria: Criteria,
  inProgressIds: ReadonlySet<string> = NONE,
): Exercise[] {
  return filterItems(
    exercises,
    solvedIds,
    criteria,
    (exercise) => Object.keys(exercise.starters),
    inProgressIds,
  );
}

/** The distinct values of a field across the catalog, in a stable order. */
export function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "fr"));
}
