import type { Quiz } from "../api/protocols";

/** What the learner has chosen, one entry per question (see `submitProtocolQuiz`). */
export type Answers = string[][];

/**
 * Nothing is chosen at first, except for an ordering question, which starts in the order it is
 * shown (never the right one: the Rust side makes sure of it).
 */
export function initialAnswers(quiz: Quiz): Answers {
  return quiz.questions.map((question) =>
    question.kind === "order" ? question.options.map((option) => option.id) : [],
  );
}

function replaceAt(answers: Answers, index: number, value: string[]): Answers {
  return answers.map((current, position) => (position === index ? value : current));
}

/** One option for a single choice (it replaces the previous one), a toggle for a multiple choice. */
export function select(answers: Answers, index: number, multiple: boolean, id: string): Answers {
  const current = answers[index] ?? [];
  if (!multiple) return replaceAt(answers, index, [id]);
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  return replaceAt(answers, index, next);
}

/** Moves an item of an ordering question by `delta` places (-1 up, +1 down), within the list. */
export function move(answers: Answers, index: number, position: number, delta: -1 | 1): Answers {
  const current = [...(answers[index] ?? [])];
  const target = position + delta;
  const item = current[position];
  const other = current[target];
  if (item === undefined || other === undefined) return answers;
  current[position] = other;
  current[target] = item;
  return replaceAt(answers, index, current);
}

/** The questions with nothing chosen yet, by index. */
export function unanswered(quiz: Quiz, answers: Answers): number[] {
  return quiz.questions.flatMap((question, index) =>
    question.kind !== "order" && (answers[index] ?? []).length === 0 ? [index] : [],
  );
}
