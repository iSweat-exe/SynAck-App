import { describe, expect, it } from "vitest";
import { choose, isAnswered, NO_ANSWERS, toProfile, type Answers } from "./answers";
import { ALLOWED, STEPS } from "./questions";

function step(key: string) {
  const found = STEPS.find((item) => item.key === key);
  if (found === undefined) throw new Error(`no step ${key}`);
  return found;
}

const COMPLETE: Answers = {
  level: ["beginner"],
  goals: ["web", "cybersecurity"],
  knownLanguages: ["python"],
  motivation: ["career"],
  weeklyTime: ["oneToThree"],
  styles: ["practice"],
};

describe("the questions", () => {
  it("should offer only values the Rust side accepts", () => {
    for (const { key, options } of STEPS) {
      for (const option of options) expect(ALLOWED[key]).toContain(option.value);
    }
  });

  it("should offer every value the Rust side accepts", () => {
    for (const { key, options } of STEPS) {
      expect(options.map((option) => option.value).sort()).toEqual([...ALLOWED[key]].sort());
    }
  });

  it("should ask each question once", () => {
    expect(new Set(STEPS.map((item) => item.key)).size).toBe(STEPS.length);
  });

  it("should not repeat an option inside a question", () => {
    for (const { options } of STEPS) {
      expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
    }
  });
});

describe("choose", () => {
  it("should replace the answer of a single question", () => {
    const first = choose(NO_ANSWERS, step("level"), "beginner");
    expect(choose(first, step("level"), "advanced").level).toEqual(["advanced"]);
  });

  it("should add an option to a multiple question", () => {
    const first = choose(NO_ANSWERS, step("goals"), "web");
    expect(choose(first, step("goals"), "games").goals).toEqual(["web", "games"]);
  });

  it("should remove an option picked twice in a multiple question", () => {
    const first = choose(NO_ANSWERS, step("goals"), "web");
    expect(choose(first, step("goals"), "web").goals).toEqual([]);
  });
});

describe("isAnswered", () => {
  it("should hold the learner back on a required question with no answer", () => {
    expect(isAnswered(step("level"), NO_ANSWERS)).toBe(false);
  });

  it("should let the learner go on when the question is optional", () => {
    expect(isAnswered(step("knownLanguages"), NO_ANSWERS)).toBe(true);
  });

  it("should let the learner go on once a required question is answered", () => {
    expect(isAnswered(step("level"), COMPLETE)).toBe(true);
  });
});

describe("toProfile", () => {
  it("should build the profile when every required question is answered", () => {
    expect(toProfile(COMPLETE)).toEqual({
      level: "beginner",
      goals: ["web", "cybersecurity"],
      knownLanguages: ["python"],
      motivation: "career",
      weeklyTime: "oneToThree",
      styles: ["practice"],
    });
  });

  it("should be null while the level is missing", () => {
    expect(toProfile({ ...COMPLETE, level: [] })).toBeNull();
  });

  it("should be null while no goal is picked", () => {
    expect(toProfile({ ...COMPLETE, goals: [] })).toBeNull();
  });

  it("should leave out a value that is not an allowed one", () => {
    expect(toProfile({ ...COMPLETE, knownLanguages: ["python", "cobol"] })?.knownLanguages).toEqual(
      ["python"],
    );
  });

  it("should accept no known language", () => {
    expect(toProfile({ ...COMPLETE, knownLanguages: [] })?.knownLanguages).toEqual([]);
  });
});
