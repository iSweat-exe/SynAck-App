import { invoke } from "@tauri-apps/api/core";

/** The Rust side rejects with a ready-to-display French message. */
function toMessage(error: unknown): string {
  return typeof error === "string" ? error : "Une erreur inattendue est survenue.";
}

/** Calls a Tauri command; failures become an `Error` whose message can be shown as is. */
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(toMessage(error), { cause: error });
  }
}
