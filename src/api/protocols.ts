import { call } from "./call";

/** Mirrors `Kind` in `src-tauri/src/protocols.rs`. */
export type QuestionKind = "single" | "multiple" | "order";

/** Mirrors `QuizOption`. The id is only a position: it says nothing about the right answer. */
export interface QuizOption {
  id: string;
  text: string;
}

/** Mirrors `QuizQuestion`. */
export interface QuizQuestion {
  kind: QuestionKind;
  prompt: string;
  options: QuizOption[];
}

/** Mirrors `Quiz`. There is no answer in it: the Rust side keeps them. */
export interface Quiz {
  questions: QuizQuestion[];
}

/** Mirrors `Review`. The details are only there for a wrong answer. */
export interface Review {
  ok: boolean;
  prompt?: string;
  /** The right option texts, in order for an ordering question. */
  correctAnswer?: string[];
  explanation?: string;
}

/** Mirrors `QuizResult`. `validated` is decided, and recorded, by the Rust side. */
export interface QuizResult {
  validated: boolean;
  correct: number;
  total: number;
  review: Review[];
}

export function getValidatedProtocols(): Promise<string[]> {
  return call<string[]>("get_validated_protocols");
}

/** A new quiz, different every time. */
export function startProtocolQuiz(protocol: string): Promise<Quiz> {
  return call<Quiz>("start_protocol_quiz", { protocol });
}

/** One answer per question: the chosen option ids, or the option ids in order. */
export function submitProtocolQuiz(protocol: string, answers: string[][]): Promise<QuizResult> {
  return call<QuizResult>("submit_protocol_quiz", { protocol, answers });
}
