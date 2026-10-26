import { describe, expect, it } from "vitest";
import type { Onboarding } from "../api/onboarding";
import type { Difficulty, Exercise } from "../api/exercises";
import { recommend } from "./recommend";

function exercise(
  id: string,
  difficulty: Difficulty,
  topics: string[] = [],
  languages: string[] = ["python", "javascript"],
): Exercise {
  return {
    id,
    title: id,
    difficulty,
    summary: "",
    topics,
    statement: "",
    input: "",
    output: "",
    notes: null,
    examples: [],
    hints: [],
    starters: Object.fromEntries(languages.map((language) => [language, ""])),
  };
}

function profile(overrides: Partial<Onboarding> = {}): Onboarding {
  return {
    level: "beginner",
    goals: ["undecided"],
    knownLanguages: [],
    motivation: "curiosity",
    weeklyTime: "oneToThree",
    styles: ["practice"],
    ...overrides,
  };
}

const EASY = exercise("easy", "easy");
const MEDIUM = exercise("medium", "medium");
const HARD = exercise("hard", "hard");
const ALL = [HARD, MEDIUM, EASY];
const NONE = new Set<string>();

const ids = (list: readonly { exercise: Exercise }[]) => list.map((item) => item.exercise.id);

describe("recommend", () => {
  it("suggests the easiest exercise first to someone who never coded", () => {
    expect(ids(recommend(profile({ level: "newcomer" }), ALL, NONE, NONE))[0]).toBe("easy");
  });

  it("suggests the hardest exercise first to an advanced learner", () => {
    expect(ids(recommend(profile({ level: "advanced" }), ALL, NONE, NONE))[0]).toBe("hard");
  });

  it("suggests a medium exercise first to an intermediate learner", () => {
    expect(ids(recommend(profile({ level: "intermediate" }), ALL, NONE, NONE))[0]).toBe("medium");
  });

  it("never suggests an exercise that is solved", () => {
    const solved = new Set(["easy"]);
    expect(ids(recommend(profile({ level: "newcomer" }), ALL, solved, NONE))).not.toContain("easy");
  });

  it("suggests nothing when everything is solved", () => {
    const solved = new Set(ALL.map((item) => item.id));
    expect(recommend(profile(), ALL, solved, NONE)).toEqual([]);
  });

  it("puts an exercise already started ahead of an easier one", () => {
    const started = new Set(["medium"]);
    expect(ids(recommend(profile({ level: "newcomer" }), ALL, NONE, started))[0]).toBe("medium");
  });

  it("does not push an exercise far above the level just because it was started", () => {
    const started = new Set(["hard"]);
    expect(ids(recommend(profile({ level: "newcomer" }), ALL, NONE, started))[0]).toBe("easy");
  });

  it("prefers the themes that go with the aims of the learner", () => {
    const strings = exercise("strings", "easy", ["Chaînes"]);
    const loops = exercise("loops", "easy", ["Boucles"]);
    const result = recommend(
      profile({ level: "newcomer", goals: ["cybersecurity"] }),
      [loops, strings],
      NONE,
      NONE,
    );
    expect(ids(result)[0]).toBe("strings");
  });

  it("prefers a language the learner already knows", () => {
    const python = exercise("python-only", "easy", [], ["python"]);
    const go = exercise("go-only", "easy", [], ["go"]);
    const result = recommend(
      profile({ level: "newcomer", knownLanguages: ["go"] }),
      [python, go],
      NONE,
      NONE,
    );
    expect(ids(result)[0]).toBe("go-only");
  });

  it("keeps the order of the catalog when two exercises fit equally", () => {
    const first = exercise("first", "easy");
    const second = exercise("second", "easy");
    expect(ids(recommend(profile({ level: "newcomer" }), [first, second], NONE, NONE))).toEqual([
      "first",
      "second",
    ]);
  });

  it("gives at most the number of exercises asked for", () => {
    expect(recommend(profile(), ALL, NONE, NONE, 2)).toHaveLength(2);
  });

  it("says why an exercise fits", () => {
    const [first] = recommend(profile({ level: "newcomer" }), ALL, NONE, NONE);
    expect(first?.reasons).toContain("Adapté à ton niveau");
  });
});
