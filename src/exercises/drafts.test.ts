import { describe, expect, it } from "vitest";
import type { Exercise } from "../api/exercises";
import { draftKey, inProgressIds, mergeDrafts } from "./drafts";

function exercise(id: string, starters: Record<string, string>): Exercise {
  return {
    id,
    title: id,
    difficulty: "easy",
    summary: "",
    topics: [],
    statement: "",
    input: "",
    output: "",
    notes: null,
    examples: [],
    hints: [],
    starters,
  };
}

const FIZZ = exercise("fizzbuzz", { python: "# départ", javascript: "// départ" });
const NONE = new Set<string>();

describe("mergeDrafts", () => {
  it("adds the drafts that were read", () => {
    const merged = mergeDrafts(
      {},
      [{ exercise: "fizzbuzz", language: "python", code: "print(1)" }],
      NONE,
    );
    expect(merged).toEqual({ "fizzbuzz:python": "print(1)" });
  });

  it("replaces a draft that the learner did not touch since the app opened", () => {
    const merged = mergeDrafts(
      { "fizzbuzz:python": "old" },
      [{ exercise: "fizzbuzz", language: "python", code: "new" }],
      NONE,
    );
    expect(merged["fizzbuzz:python"]).toBe("new");
  });

  it("never replaces what the learner typed since the app opened", () => {
    const merged = mergeDrafts(
      { "fizzbuzz:python": "typed" },
      [{ exercise: "fizzbuzz", language: "python", code: "read" }],
      new Set(["fizzbuzz:python"]),
    );
    expect(merged["fizzbuzz:python"]).toBe("typed");
  });
});

describe("inProgressIds", () => {
  it("is empty when nothing was written", () => {
    expect(inProgressIds([FIZZ], NONE, {}).size).toBe(0);
  });

  it("includes an exercise whose code is not the starter code", () => {
    const drafts = { [draftKey("fizzbuzz", "python")]: "print(1)" };
    expect(inProgressIds([FIZZ], NONE, drafts).has("fizzbuzz")).toBe(true);
  });

  it("does not include an exercise whose code is still the starter code", () => {
    const drafts = { [draftKey("fizzbuzz", "python")]: "# départ\n" };
    expect(inProgressIds([FIZZ], NONE, drafts).size).toBe(0);
  });

  it("does not include an exercise whose code was emptied", () => {
    const drafts = { [draftKey("fizzbuzz", "python")]: "  \n" };
    expect(inProgressIds([FIZZ], NONE, drafts).size).toBe(0);
  });

  it("does not include an exercise that is solved", () => {
    const drafts = { [draftKey("fizzbuzz", "python")]: "print(1)" };
    expect(inProgressIds([FIZZ], new Set(["fizzbuzz"]), drafts).size).toBe(0);
  });

  it("includes an exercise started in the other language only", () => {
    const drafts = { [draftKey("fizzbuzz", "javascript")]: "console.log(1)" };
    expect(inProgressIds([FIZZ], NONE, drafts).has("fizzbuzz")).toBe(true);
  });
});
