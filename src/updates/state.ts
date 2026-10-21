import type { DownloadProgress } from "../api/updater";

/** Where the application stands with its updates. */
export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "upToDate" }
  | { status: "available"; version: string; notes: string | null }
  | {
      status: "downloading";
      version: string;
      notes: string | null;
      downloaded: number;
      /** Unknown when the server does not say how big the file is. */
      total: number | null;
    }
  | { status: "ready"; version: string }
  | { status: "failed"; message: string };

export type UpdateEvent =
  | { type: "checkStarted" }
  | { type: "checkFinished"; update: { version: string; notes: string | null } | null }
  | { type: "downloadStarted" }
  | { type: "progress"; progress: DownloadProgress }
  | { type: "installed" }
  | { type: "failed"; message: string };

export const INITIAL: UpdateState = { status: "idle" };

/**
 * The next state. A check never interrupts a download that runs or an update that waits for its
 * restart: what the learner started is not undone by the check that runs every few hours.
 */
export function reduce(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case "checkStarted":
      return state.status === "downloading" || state.status === "ready"
        ? state
        : { status: "checking" };
    case "checkFinished":
      if (state.status !== "checking") return state;
      return event.update === null
        ? { status: "upToDate" }
        : { status: "available", version: event.update.version, notes: event.update.notes };
    case "downloadStarted":
      return state.status === "available"
        ? {
            status: "downloading",
            version: state.version,
            notes: state.notes,
            downloaded: 0,
            total: null,
          }
        : state;
    case "progress": {
      if (state.status !== "downloading") return state;
      const { progress } = event;
      if (progress.kind === "started") return { ...state, total: progress.total };
      if (progress.kind === "chunk")
        return { ...state, downloaded: state.downloaded + progress.bytes };
      return state;
    }
    case "installed":
      return state.status === "downloading" ? { status: "ready", version: state.version } : state;
    case "failed":
      return { status: "failed", message: event.message };
  }
}

/** How far the download is, 0 to 100, or `null` when the size is unknown. */
export function percent(state: Extract<UpdateState, { status: "downloading" }>): number | null {
  if (state.total === null || state.total <= 0) return null;
  return Math.min(100, Math.round((state.downloaded / state.total) * 100));
}
