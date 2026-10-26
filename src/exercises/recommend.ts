import type { Onboarding } from "../api/onboarding";
import type { Difficulty, Exercise } from "../api/exercises";

/** An exercise suggested to the learner, with what makes it a good fit. */
export interface Recommendation {
  exercise: Exercise;
  reasons: string[];
}

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Where each level should aim: a beginner is between easy and medium. */
const TARGET: Record<Onboarding["level"], number> = {
  newcomer: 0,
  beginner: 0.5,
  intermediate: 1,
  advanced: 2,
};

/** The themes of the exercises that go with each aim. A starting point, easy to adjust. */
const TOPICS_OF_GOAL: Record<Onboarding["goals"][number], readonly string[]> = {
  web: ["Chaînes", "Dictionnaires", "Listes"],
  software: ["Boucles", "Conditions", "Listes"],
  cybersecurity: ["Chaînes", "Calculs"],
  dataAi: ["Listes", "Dictionnaires", "Calculs", "Programmation dynamique"],
  games: ["Calculs", "Boucles", "Graphes"],
  systems: ["Calculs", "Boucles", "Graphes"],
  devops: ["Chaînes", "Dictionnaires", "Graphes"],
  undecided: [],
};

interface Scored extends Recommendation {
  score: number;
  position: number;
}

function score(
  profile: Onboarding,
  exercise: Exercise,
  inProgress: boolean,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let total = 0;

  // The nearer the difficulty to the level, the better: the main criterion.
  const gap = Math.abs(RANK[exercise.difficulty] - TARGET[profile.level]);
  total += 3 - gap * 2;
  if (gap <= 0.5) reasons.push("Adapté à ton niveau");

  const topic = exercise.topics.find((candidate) =>
    profile.goals.some((goal) => TOPICS_OF_GOAL[goal].includes(candidate)),
  );
  if (topic !== undefined) {
    total += 1.5;
    reasons.push(`Thème : ${topic}`);
  }

  if (profile.knownLanguages.some((language) => language in exercise.starters)) {
    total += 1;
    reasons.push("Dans un langage que tu connais");
  }

  // Finishing what was started comes first, unless it is far above the level.
  if (inProgress) {
    total += 3;
    reasons.push("Tu l'as déjà commencé");
  }

  return { score: total, reasons };
}

/**
 * The exercises to suggest next: the ones not solved yet, best fit first. It weighs the level
 * (the nearer the difficulty, the better), the aims (themes that go with them), the languages the
 * learner already knows, and what they already started. Ties keep the order of the catalog.
 */
export function recommend(
  profile: Onboarding,
  exercises: readonly Exercise[],
  solvedIds: ReadonlySet<string>,
  inProgressIds: ReadonlySet<string>,
  limit = 3,
): Recommendation[] {
  const candidates: Scored[] = exercises.flatMap((exercise, position) => {
    if (solvedIds.has(exercise.id)) return [];
    const { score: value, reasons } = score(profile, exercise, inProgressIds.has(exercise.id));
    return [{ exercise, reasons, score: value, position }];
  });
  return candidates
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map(({ exercise, reasons }) => ({ exercise, reasons }));
}
