import { describe, expect, it } from "vitest";
import type { Exercise } from "../api/exercises";
import { PROTOCOLS } from "../protocols/catalog";
import { buildEntries, searchEntries } from "./search";

function exercise(id: string, title: string, topics: string[] = []): Exercise {
  return {
    id,
    title,
    difficulty: "easy",
    summary: `Résumé de ${title}`,
    topics,
    statement: "",
    input: "",
    output: "",
    notes: null,
    examples: [],
    hints: [],
    starters: {},
  };
}

const ENTRIES = buildEntries(
  [
    exercise("fibonacci", "Suite de Fibonacci", ["Boucles", "Suites"]),
    exercise("fizzbuzz", "FizzBuzz", ["Boucles", "Conditions"]),
    exercise("caesar", "Chiffre de César", ["Chaînes"]),
  ],
  PROTOCOLS,
);

const keys = (query: string, limit?: number) =>
  searchEntries(ENTRIES, query, limit).map((item) => item.key);

describe("searchEntries", () => {
  it("offers the pages when there is no query", () => {
    expect(keys("").every((key) => key.startsWith("page:"))).toBe(true);
  });

  it("finds an exercise by its title, whatever the capitals", () => {
    expect(keys("FIBONACCI")).toContain("exercise:fibonacci");
  });

  it("finds an exercise whatever the accents", () => {
    expect(keys("cesar")).toContain("exercise:caesar");
  });

  it("finds an exercise by its theme", () => {
    expect(keys("conditions")).toContain("exercise:fizzbuzz");
  });

  it("finds a protocol by its name", () => {
    expect(keys("tcp")).toContain("protocol:tcp");
  });

  it("finds a page", () => {
    expect(keys("environnement")).toContain("page:environment");
  });

  it("needs every word of the query to match", () => {
    expect(keys("suite fizz")).toEqual([]);
  });

  it("finds nothing when nothing matches", () => {
    expect(keys("zzzzz")).toEqual([]);
  });

  it("puts a title that starts with the query before one that only contains it", () => {
    const entries = buildEntries(
      [exercise("b", "Compter les voyelles"), exercise("a", "Voyelles et consonnes")],
      [],
    );
    expect(searchEntries(entries, "voyelles").map((item) => item.key)[0]).toBe("exercise:a");
  });

  it("gives at most the number of results asked for", () => {
    expect(keys("e", 3)).toHaveLength(3);
  });

  it("leads an exercise to its page", () => {
    const [first] = searchEntries(ENTRIES, "fizzbuzz");
    expect(first?.target).toEqual({ type: "exercise", id: "fizzbuzz" });
  });
});
