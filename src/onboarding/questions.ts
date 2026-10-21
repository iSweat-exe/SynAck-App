import {
  GOALS,
  LANGUAGES,
  LEVELS,
  MOTIVATIONS,
  STYLES,
  WEEKLY_TIMES,
  type Onboarding,
} from "../api/onboarding";

/** The questions, in the order they are asked. Each is a key of the answers the Rust side keeps. */
export type StepKey = keyof Onboarding;

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface Step {
  key: StepKey;
  /** One answer (radio buttons) or several (checkboxes). */
  kind: "single" | "multiple";
  /** A required step needs at least one answer before the learner can go on. */
  required: boolean;
  title: string;
  help: string;
  options: readonly Option[];
}

export const STEPS: readonly Step[] = [
  {
    key: "level",
    kind: "single",
    required: true,
    title: "Où en es-tu en programmation ?",
    help: "Sois honnête : personne n'est jugé. Ça sert à te proposer le bon point de départ.",
    options: [
      { value: "newcomer", label: "Je n'ai jamais codé", hint: "Je pars de zéro." },
      {
        value: "beginner",
        label: "Débutant",
        hint: "J'ai écrit quelques petits programmes (variables, boucles).",
      },
      {
        value: "intermediate",
        label: "Intermédiaire",
        hint: "Je me débrouille seul sur de petits projets.",
      },
      {
        value: "advanced",
        label: "Avancé",
        hint: "Je code régulièrement et je veux aller plus loin.",
      },
    ],
  },
  {
    key: "goals",
    kind: "multiple",
    required: true,
    title: "Qu'est-ce qui t'attire le plus ?",
    help: "Coche tout ce qui t'intéresse. Tu pourras changer d'avis plus tard.",
    options: [
      { value: "web", label: "Web", hint: "Sites et applications dans le navigateur." },
      { value: "software", label: "Logiciels", hint: "Applications de bureau, mobiles, outils." },
      {
        value: "cybersecurity",
        label: "Cybersécurité",
        hint: "Comprendre les attaques et savoir s'en défendre.",
      },
      {
        value: "dataAi",
        label: "Données et IA",
        hint: "Analyser des données, apprendre aux machines.",
      },
      { value: "games", label: "Jeux vidéo", hint: "Mécaniques, moteurs, graphismes." },
      {
        value: "systems",
        label: "Systèmes et embarqué",
        hint: "Bas niveau, performance, matériel.",
      },
      {
        value: "devops",
        label: "Réseaux et DevOps",
        hint: "Serveurs, déploiement, infrastructure.",
      },
      { value: "undecided", label: "Je ne sais pas encore", hint: "On explorera ensemble." },
    ],
  },
  {
    key: "knownLanguages",
    kind: "multiple",
    required: false,
    title: "Quels langages connais-tu déjà ?",
    help: "Coche ceux que tu as déjà utilisés. Si tu n'en connais aucun, passe à la suite.",
    options: [
      { value: "python", label: "Python" },
      { value: "javascript", label: "JavaScript" },
      { value: "rust", label: "Rust" },
      { value: "go", label: "Go" },
      { value: "c", label: "C" },
      { value: "cpp", label: "C++" },
      { value: "java", label: "Java" },
    ],
  },
  {
    key: "motivation",
    kind: "single",
    required: true,
    title: "Pourquoi apprends-tu à coder ?",
    help: "Un but clair aide à choisir ce qui vaut la peine d'être appris en premier.",
    options: [
      { value: "career", label: "Pour mon métier", hint: "Reconversion ou évolution." },
      { value: "studies", label: "Pour mes études" },
      { value: "project", label: "Pour un projet personnel" },
      { value: "curiosity", label: "Par curiosité" },
    ],
  },
  {
    key: "weeklyTime",
    kind: "single",
    required: true,
    title: "Combien de temps par semaine ?",
    help: "Pour proposer un rythme réaliste, pas pour te mettre la pression.",
    options: [
      { value: "underOneHour", label: "Moins d'1 heure" },
      { value: "oneToThree", label: "1 à 3 heures" },
      { value: "threeToSeven", label: "3 à 7 heures" },
      { value: "overSeven", label: "Plus de 7 heures" },
    ],
  },
  {
    key: "styles",
    kind: "multiple",
    required: true,
    title: "Comment aimes-tu apprendre ?",
    help: "Choisis ce qui t'aide le plus. On pourra mélanger.",
    options: [
      { value: "reading", label: "Lire des explications" },
      { value: "practice", label: "Pratiquer tout de suite" },
      { value: "visual", label: "Schémas et animations" },
      { value: "challenges", label: "Défis et progression" },
    ],
  },
];

/** The values the Rust side accepts for each question, to check the options against. */
export const ALLOWED: Record<StepKey, readonly string[]> = {
  level: LEVELS,
  goals: GOALS,
  knownLanguages: LANGUAGES,
  motivation: MOTIVATIONS,
  weeklyTime: WEEKLY_TIMES,
  styles: STYLES,
};
