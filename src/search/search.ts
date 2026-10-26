import type { Exercise } from "../api/exercises";
import { DIFFICULTY_LABEL } from "../exercises/labels";
import { normalizeText } from "../exercises/filter";
import type { Protocol } from "../protocols/types";

/** The settings sections the search can open. Mirrors `SettingsSection`. */
export type SettingsTarget = "appearance" | "environment" | "updates";

/** Where an entry of the search leads. */
export type SearchTarget =
  | { type: "exercise"; id: string }
  | { type: "protocol"; id: string }
  | {
      type: "page";
      view: "exercises" | "protocols" | "profile" | "settings";
      section?: SettingsTarget;
    };

export type SearchKind = "page" | "exercise" | "protocol";

export const KIND_LABEL: Record<SearchKind, string> = {
  page: "Page",
  exercise: "Exercice",
  protocol: "Protocole",
};

export interface SearchEntry {
  key: string;
  kind: SearchKind;
  title: string;
  /** A line under the title, to tell two results apart. */
  detail: string;
  target: SearchTarget;
  /** Everything that can be matched, without accents or capitals. */
  haystack: string;
  /** The title, normalized the same way, to rank the results. */
  normalizedTitle: string;
}

function entry(
  kind: SearchKind,
  id: string,
  title: string,
  detail: string,
  words: readonly string[],
  target: SearchTarget,
): SearchEntry {
  return {
    key: `${kind}:${id}`,
    kind,
    title,
    detail,
    target,
    haystack: normalizeText([title, detail, ...words].join(" ")),
    normalizedTitle: normalizeText(title),
  };
}

const PAGES: readonly SearchEntry[] = [
  entry("page", "exercises", "Exercices", "Les exercices de code", ["code", "pratiquer"], {
    type: "page",
    view: "exercises",
  }),
  entry(
    "page",
    "protocols",
    "Protocoles",
    "Comprendre les protocoles réseau",
    ["réseau", "cours"],
    {
      type: "page",
      view: "protocols",
    },
  ),
  entry("page", "profile", "Profil", "Tes préférences, ta progression", ["compte", "préférences"], {
    type: "page",
    view: "profile",
  }),
  entry(
    "page",
    "appearance",
    "Réglages : Apparence",
    "Thème clair ou sombre",
    ["thème", "sombre"],
    {
      type: "page",
      view: "settings",
      section: "appearance",
    },
  ),
  entry(
    "page",
    "environment",
    "Réglages : Environnement",
    "Les outils installés sur cet ordinateur",
    ["python", "node", "compilateur", "installer"],
    { type: "page", view: "settings", section: "environment" },
  ),
  entry(
    "page",
    "updates",
    "Réglages : Mises à jour",
    "La version et les nouveautés",
    ["version", "mettre à jour"],
    { type: "page", view: "settings", section: "updates" },
  ),
];

/** Everything the search can find: the pages, the exercises and the protocols. */
export function buildEntries(
  exercises: readonly Exercise[],
  protocols: readonly Protocol[],
): SearchEntry[] {
  return [
    ...PAGES,
    ...exercises.map((exercise) =>
      entry(
        "exercise",
        exercise.id,
        exercise.title,
        `${DIFFICULTY_LABEL[exercise.difficulty]} · ${exercise.summary}`,
        exercise.topics,
        { type: "exercise", id: exercise.id },
      ),
    ),
    ...protocols.map((protocol) =>
      entry("protocol", protocol.id, protocol.name, protocol.tagline, protocol.topics, {
        type: "protocol",
        id: protocol.id,
      }),
    ),
  ];
}

/**
 * The entries matching the query: every word must appear somewhere (accents and capitals do not
 * matter). A title that starts with the query comes first, then a title that contains it, then
 * the rest. With no query, the pages are offered.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  limit = 8,
): SearchEntry[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries.filter((item) => item.kind === "page").slice(0, limit);

  const joined = words.join(" ");
  const ranked = entries.flatMap((item, position) => {
    if (!words.every((word) => item.haystack.includes(word))) return [];
    const rank = item.normalizedTitle.startsWith(joined)
      ? 0
      : words.every((word) => item.normalizedTitle.includes(word))
        ? 1
        : 2;
    return [{ item, rank, position }];
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .slice(0, limit)
    .map(({ item }) => item);
}
