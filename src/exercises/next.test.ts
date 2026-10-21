import { describe, expect, it } from "vitest";
import type { Exercise } from "../api/exercises";
import { nextUnsolved } from "./next";

function exercise(id: string): Exercise {
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
    starters: {},
  };
}

const ALL = ["a", "b", "c", "d"].map(exercise);
const none = new Set<string>();

describe("nextUnsolved", () => {
  it("suggests the following exercise when nothing else is solved", () => {
    expect(nextUnsolved(ALL, none, "a")?.id).toBe("b");
  });

  it("skips the exercises that are already solved", () => {
    expect(nextUnsolved(ALL, new Set(["b", "c"]), "a")?.id).toBe("d");
  });

  it("goes round to the beginning after the last exercise", () => {
    expect(nextUnsolved(ALL, none, "d")?.id).toBe("a");
  });

  it("goes round to find an unsolved exercise before the current one", () => {
    expect(nextUnsolved(ALL, new Set(["c", "d"]), "b")?.id).toBe("a");
  });

  it("never suggests the current exercise, even if it is not marked as solved yet", () => {
    expect(nextUnsolved(ALL, new Set(["b", "c", "d"]), "a")).toBeNull();
  });

  it("is null when the catalog has only the current exercise", () => {
    expect(nextUnsolved([exercise("a")], none, "a")).toBeNull();
  });
});
