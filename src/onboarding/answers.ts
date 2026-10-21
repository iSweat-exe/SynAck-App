import {
  GOALS,
  LANGUAGES,
  LEVELS,
  MOTIVATIONS,
  STYLES,
  WEEKLY_TIMES,
  type Onboarding,
} from "../api/onboarding";
import type { Step, StepKey } from "./questions";

/** What the learner has picked so far, for every question. */
export type Answers = Record<StepKey, readonly string[]>;

export const NO_ANSWERS: Answers = {
  level: [],
  goals: [],
  knownLanguages: [],
  motivation: [],
  weeklyTime: [],
  styles: [],
};

/** Picks an option: it replaces the answer of a single question, or toggles it in a multiple one. */
export function choose(answers: Answers, step: Step, value: string): Answers {
  const current = answers[step.key];
  if (step.kind === "single") return { ...answers, [step.key]: [value] };
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return { ...answers, [step.key]: next };
}

/** Whether the learner can go on from this question. */
export function isAnswered(step: Step, answers: Answers): boolean {
  return !step.required || answers[step.key].length > 0;
}

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  return list.find((item) => item === value);
}

function allOf<T extends string>(list: readonly T[], values: readonly string[]): T[] {
  return values.flatMap((value) => oneOf(list, value) ?? []);
}

/** The answers in the shape the Rust side keeps, or `null` while one is missing. */
export function toProfile(answers: Answers): Onboarding | null {
  const level = oneOf(LEVELS, answers.level[0]);
  const motivation = oneOf(MOTIVATIONS, answers.motivation[0]);
  const weeklyTime = oneOf(WEEKLY_TIMES, answers.weeklyTime[0]);
  const goals = allOf(GOALS, answers.goals);
  const styles = allOf(STYLES, answers.styles);
  if (
    level === undefined ||
    motivation === undefined ||
    weeklyTime === undefined ||
    goals.length === 0 ||
    styles.length === 0
  ) {
    return null;
  }
  return {
    level,
    goals,
    knownLanguages: allOf(LANGUAGES, answers.knownLanguages),
    motivation,
    weeklyTime,
    styles,
  };
}
