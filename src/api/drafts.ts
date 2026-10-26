import { call } from "./call";

/** Mirrors `Draft` in `src-tauri/src/drafts.rs`: the code written for an exercise, in a language. */
export interface Draft {
  exercise: string;
  language: string;
  code: string;
}

/** Every draft of the signed-in account. */
export function getDrafts(): Promise<Draft[]> {
  return call<Draft[]>("get_drafts");
}

/** Keeps the code of an exercise in progress; the Rust side sends it to the server later. */
export async function saveDraft(exercise: string, language: string, code: string): Promise<void> {
  // The Rust command returns `()`, which arrives as `null`.
  await call<null>("save_draft", { exercise, language, code });
}
