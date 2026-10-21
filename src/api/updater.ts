import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

/** What the download of an update reports while it runs. */
export type DownloadProgress =
  | { kind: "started"; total: number | null }
  | { kind: "chunk"; bytes: number }
  | { kind: "finished" };

/** A newer version found on the GitHub releases. */
export interface AvailableUpdate {
  version: string;
  /** The notes of the release (the changelog of this version), if it has any. */
  notes: string | null;
  /** Downloads it, verifies its signature and installs it. The plugin does it all in Rust. */
  install: (onProgress: (progress: DownloadProgress) => void) => Promise<void>;
}

/** Whether the application can update itself: false in a plain browser, such as `npm run dev`. */
export function canUpdate(): boolean {
  return isTauri();
}

/** Asks the releases for a version newer than this one. `null` when this one is the latest. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isTauri()) throw new Error("Les mises à jour ne marchent que dans l'application installée.");
  const update = await check();
  if (update === null) return null;
  return {
    version: update.version,
    notes: update.body ?? null,
    install: async (onProgress) => {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          onProgress({ kind: "started", total: event.data.contentLength ?? null });
        } else if (event.event === "Progress") {
          onProgress({ kind: "chunk", bytes: event.data.chunkLength });
        } else {
          onProgress({ kind: "finished" });
        }
      });
    },
  };
}

/** Closes the application and opens it again, on the new version. */
export async function restartApp(): Promise<void> {
  await relaunch();
}
