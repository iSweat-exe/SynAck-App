/**
 * A protocol is described as DATA: who talks, and what they say, step by step. The same engine
 * (`SequenceDiagram`) draws and animates every one of them. To add a protocol, add a file in
 * `data/` and list it in `catalog.ts`: no component changes.
 */

import type { Difficulty } from "../api/exercises";

/** The color of a message: it says what kind of message it is. */
export type Tone = "brand" | "neutral" | "success" | "warning" | "danger";

export interface Actor {
  id: string;
  /** Short: it is written in the header of a column of the diagram. */
  name: string;
  /** What this actor is, shown under the name when there is room. */
  role?: string;
  /** The state of the actor before the first step (`LISTEN`, `Hors ligne`...). */
  state?: string;
}

/** What happens to a message when the learner asks to simulate a lost packet. */
export interface Loss {
  /** The message disappears on the way. */
  lost: string;
  /** The sender waits, then gives up. */
  wait: string;
  /** The sender sends it again. */
  retry: string;
}

export interface Step {
  from: string;
  /** The same id as `from` means the actor does something alone (a check, a computation). */
  to: string;
  /** Short: it is written on the arrow. */
  label: string;
  /** One or two sentences explaining what happens, shown while the step plays. */
  note: string;
  /** What the message looks like on the wire, shown as code. */
  detail?: string;
  tone?: Tone;
  /** The state of some actors once this step is done. */
  states?: Record<string, string>;
  loss?: Loss;
}

/**
 * One piece of the course. There is one lesson for every subject of the quiz
 * (`src-tauri/protocols/<id>.json`), so that nothing a question asks is missing from the course.
 */
export interface Lesson {
  /** The subject of the quiz it teaches, word for word: "la poignée de main en trois temps". */
  subject: string;
  /** What to know, as short statements. For a lesson with `steps`, a line that introduces them. */
  points: readonly string[];
  /** The events in chronological order, word for word as the quiz asks them. */
  steps?: readonly string[];
}

export interface Fact {
  label: string;
  value: string;
}

export interface Protocol {
  id: string;
  /** In the tab. */
  name: string;
  fullName: string;
  /** One sentence. */
  tagline: string;
  difficulty: Difficulty;
  /** Themes the learner can filter on, e.g. "Sécurité". */
  topics: readonly string[];
  /** Ids of the protocols to know before this one. They come earlier in the catalog. */
  prerequisites: readonly string[];
  /** What to know that is not a protocol of the course (a terminal, a process...). */
  notions: readonly string[];
  /** Paragraphs: what it is for, and why it exists. */
  purpose: readonly string[];
  /** The things to remember. */
  takeaways: readonly string[];
  /** The course in detail: one lesson per subject of the quiz. */
  lessons: readonly Lesson[];
  /** The summary table (layer, port...). */
  facts: readonly Fact[];
  actors: readonly Actor[];
  steps: readonly Step[];
  /** Ids of the protocols worth reading next. */
  related: readonly string[];
}
