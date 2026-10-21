import { describe, expect, it } from "vitest";
import type { Quiz } from "../api/protocols";
import { initialAnswers, move, select, unanswered } from "./answers";

const option = (id: string) => ({ id, text: `option ${id}` });

const QUIZ: Quiz = {
  questions: [
    { kind: "single", prompt: "a", options: ["0", "1", "2", "3"].map(option) },
    { kind: "multiple", prompt: "b", options: ["0", "1", "2", "3"].map(option) },
    { kind: "order", prompt: "c", options: ["0", "1", "2"].map(option) },
  ],
};

describe("initialAnswers", () => {
  it("leaves the choice questions empty", () => {
    expect(initialAnswers(QUIZ).slice(0, 2)).toEqual([[], []]);
  });

  it("starts an ordering question in the order it is shown", () => {
    expect(initialAnswers(QUIZ)[2]).toEqual(["0", "1", "2"]);
  });
});

describe("select", () => {
  it("replaces the previous choice of a single choice question", () => {
    const first = select(initialAnswers(QUIZ), 0, false, "1");
    expect(select(first, 0, false, "3")[0]).toEqual(["3"]);
  });

  it("adds an option to a multiple choice question", () => {
    const first = select(initialAnswers(QUIZ), 1, true, "0");
    expect(select(first, 1, true, "2")[1]).toEqual(["0", "2"]);
  });

  it("removes an option already chosen in a multiple choice question", () => {
    const first = select(initialAnswers(QUIZ), 1, true, "0");
    expect(select(first, 1, true, "0")[1]).toEqual([]);
  });

  it("leaves the other questions alone", () => {
    const answers = select(initialAnswers(QUIZ), 0, false, "2");
    expect(answers[1]).toEqual([]);
    expect(answers[2]).toEqual(["0", "1", "2"]);
  });

  it("does not change the answers it was given", () => {
    const before = initialAnswers(QUIZ);
    select(before, 0, false, "2");
    expect(before[0]).toEqual([]);
  });
});

describe("move", () => {
  it("moves an item down", () => {
    expect(move(initialAnswers(QUIZ), 2, 0, 1)[2]).toEqual(["1", "0", "2"]);
  });

  it("moves an item up", () => {
    expect(move(initialAnswers(QUIZ), 2, 2, -1)[2]).toEqual(["0", "2", "1"]);
  });

  it("does not move the first item up", () => {
    const answers = initialAnswers(QUIZ);
    expect(move(answers, 2, 0, -1)).toBe(answers);
  });

  it("does not move the last item down", () => {
    const answers = initialAnswers(QUIZ);
    expect(move(answers, 2, 2, 1)).toBe(answers);
  });
});

describe("unanswered", () => {
  it("lists the choice questions with nothing chosen", () => {
    expect(unanswered(QUIZ, initialAnswers(QUIZ))).toEqual([0, 1]);
  });

  it("never counts an ordering question, which always has an answer", () => {
    const answers = select(select(initialAnswers(QUIZ), 0, false, "1"), 1, true, "2");
    expect(unanswered(QUIZ, answers)).toEqual([]);
  });

  it("counts a multiple choice again once everything is unticked", () => {
    const ticked = select(initialAnswers(QUIZ), 1, true, "2");
    expect(unanswered(QUIZ, select(ticked, 1, true, "2"))).toContain(1);
  });
});
