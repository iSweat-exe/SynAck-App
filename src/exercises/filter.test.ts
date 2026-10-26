import { describe, expect, it } from "vitest";
import type { Exercise } from "../api/exercises";
import { distinct, filterExercises, isFiltering, NO_FILTER, normalizeText } from "./filter";

function exercise(overrides: Partial<Exercise> & Pick<Exercise, "id">): Exercise {
  return {
    title: "Titre",
    difficulty: "easy",
    summary: "Résumé",
    topics: [],
    statement: "",
    input: "",
    output: "",
    notes: null,
    examples: [],
    starters: { python: "", javascript: "" },
    ...overrides,
  };
}

const FIBONACCI = exercise({
  id: "fibonacci",
  title: "Suite de Fibonacci",
  summary: "Affiche les n premiers termes.",
  topics: ["Boucles", "Suites"],
});
const DICT = exercise({
  id: "dict",
  title: "Additionner les valeurs d'un dictionnaire",
  difficulty: "medium",
  topics: ["Dictionnaires"],
  starters: { python: "" },
});
const FIZZBUZZ = exercise({
  id: "fizzbuzz",
  title: "FizzBuzz",
  difficulty: "hard",
  topics: ["Boucles", "Conditions"],
});
const ALL = [FIBONACCI, DICT, FIZZBUZZ];
const NONE_SOLVED = new Set<string>();

const ids = (list: readonly Exercise[]) => list.map((item) => item.id);

describe("filterExercises", () => {
  it("keeps everything when no criterion is set", () => {
    expect(ids(filterExercises(ALL, NONE_SOLVED, NO_FILTER))).toEqual([
      "fibonacci",
      "dict",
      "fizzbuzz",
    ]);
  });

  it("finds an exercise whatever the case and the accents of the query", () => {
    const criteria = { ...NO_FILTER, query: "DICTIONNAIRE" };
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria))).toEqual(["dict"]);
  });

  it("requires every word of the query to match", () => {
    const criteria = { ...NO_FILTER, query: "suite boucles" };
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria))).toEqual(["fibonacci"]);
  });

  it("searches the topics as well as the title", () => {
    const criteria = { ...NO_FILTER, query: "conditions" };
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria))).toEqual(["fizzbuzz"]);
  });

  it("treats several difficulties as alternatives", () => {
    const criteria = { ...NO_FILTER, difficulties: ["easy" as const, "hard" as const] };
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria))).toEqual(["fibonacci", "fizzbuzz"]);
  });

  it("keeps the exercises that offer at least one of the chosen languages", () => {
    const criteria = { ...NO_FILTER, languages: ["javascript"] };
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria))).toEqual(["fibonacci", "fizzbuzz"]);
  });

  it("combines the groups: all of them must hold", () => {
    const criteria = { ...NO_FILTER, topics: ["Boucles"], difficulties: ["hard" as const] };
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria))).toEqual(["fizzbuzz"]);
  });

  it("lists only the solved exercises when the status is solved", () => {
    const criteria = { ...NO_FILTER, status: "solved" as const };
    expect(ids(filterExercises(ALL, new Set(["dict"]), criteria))).toEqual(["dict"]);
  });

  it("lists only the unsolved exercises when the status is todo", () => {
    const criteria = { ...NO_FILTER, status: "todo" as const };
    expect(ids(filterExercises(ALL, new Set(["dict"]), criteria))).toEqual([
      "fibonacci",
      "fizzbuzz",
    ]);
  });

  it("lists only the exercises started and not solved when the status is progress", () => {
    const criteria = { ...NO_FILTER, status: "progress" as const };
    const started = new Set(["fibonacci", "dict"]);
    expect(ids(filterExercises(ALL, new Set(["dict"]), criteria, started))).toEqual(["fibonacci"]);
  });

  it("keeps the exercises in progress among those to do", () => {
    const criteria = { ...NO_FILTER, status: "todo" as const };
    const started = new Set(["fibonacci"]);
    expect(ids(filterExercises(ALL, NONE_SOLVED, criteria, started))).toEqual([
      "fibonacci",
      "dict",
      "fizzbuzz",
    ]);
  });

  it("returns nothing when no exercise matches", () => {
    const criteria = { ...NO_FILTER, query: "zzz" };
    expect(filterExercises(ALL, NONE_SOLVED, criteria)).toEqual([]);
  });
});

describe("isFiltering", () => {
  it("is false for the empty criteria and for a blank query", () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: "   " })).toBe(false);
  });

  it("is true as soon as one criterion is set", () => {
    expect(isFiltering({ ...NO_FILTER, topics: ["Listes"] })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, status: "todo" })).toBe(true);
  });
});

describe("normalizeText and distinct", () => {
  it("removes accents and case", () => {
    expect(normalizeText("Éléphant Ça")).toBe("elephant ca");
  });

  it("returns each value once, sorted", () => {
    expect(distinct(["Listes", "Boucles", "Listes"])).toEqual(["Boucles", "Listes"]);
  });
});
