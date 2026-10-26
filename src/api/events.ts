import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Emitted by the Rust side when a synchronization brought progress that was not known here. */
const PROGRESS_CHANGED = "progress-changed";

/** Calls `handler` each time progress from another computer arrives. Resolves to a stop function. */
export function onProgressChanged(handler: () => void): Promise<UnlistenFn> {
  return listen(PROGRESS_CHANGED, handler);
}
