import { call } from "./call";

// Mirrors `src-tauri/src/onboarding.rs`. The lists are the only values the Rust side accepts.

export const LEVELS = ["newcomer", "beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const GOALS = [
  "web",
  "software",
  "cybersecurity",
  "dataAi",
  "games",
  "systems",
  "devops",
  "undecided",
] as const;
export type Goal = (typeof GOALS)[number];

export const LANGUAGES = ["python", "javascript", "rust", "go", "c", "cpp", "java"] as const;
export type Language = (typeof LANGUAGES)[number];

export const MOTIVATIONS = ["career", "studies", "project", "curiosity"] as const;
export type Motivation = (typeof MOTIVATIONS)[number];

export const WEEKLY_TIMES = ["underOneHour", "oneToThree", "threeToSeven", "overSeven"] as const;
export type WeeklyTime = (typeof WEEKLY_TIMES)[number];

export const STYLES = ["reading", "practice", "visual", "challenges"] as const;
export type Style = (typeof STYLES)[number];

/** Mirrors `Onboarding`: what a learner says about themselves, for recommendations later on. */
export interface Onboarding {
  level: Level;
  goals: Goal[];
  knownLanguages: Language[];
  motivation: Motivation;
  weeklyTime: WeeklyTime;
  styles: Style[];
}

/** The answers of this account, or `null` if it has not been through the questions yet. */
export function getOnboarding(userId: string): Promise<Onboarding | null> {
  return call<Onboarding | null>("get_onboarding", { userId });
}

export async function saveOnboarding(userId: string, answers: Onboarding): Promise<void> {
  // The Rust command returns `()`, which arrives as `null`.
  await call<null>("save_onboarding", { userId, answers });
}
