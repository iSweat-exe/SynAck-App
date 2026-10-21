import { useCallback, useEffect, useReducer, useRef } from "react";
import { canUpdate, checkForUpdate, restartApp, type AvailableUpdate } from "../api/updater";
import { INITIAL, reduce, type UpdateState } from "./state";

/** After launch, wait a little before the first check, so that it does not compete with the start. */
const FIRST_CHECK_DELAY_MS = 5_000;
/** Then look again from time to time: the application may stay open for days. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export interface Updater {
  state: UpdateState;
  /** The version running now. */
  currentVersion: string;
  /** Looks for a newer version. */
  checkNow: () => Promise<void>;
  /** Downloads and installs the update that was found. */
  install: () => Promise<void>;
  /** Restarts the application on the new version. */
  restart: () => Promise<void>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

/**
 * The updates of the application, from the GitHub releases. It looks by itself a few seconds after
 * the launch and every six hours, but never in `npm run dev`, where there is nothing to find. The
 * learner decides when to install: nothing is downloaded or restarted without a click.
 */
export function useUpdater(): Updater {
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const found = useRef<AvailableUpdate | null>(null);

  const checkNow = useCallback(async () => {
    dispatch({ type: "checkStarted" });
    try {
      const update = await checkForUpdate();
      found.current = update;
      dispatch({
        type: "checkFinished",
        update: update === null ? null : { version: update.version, notes: update.notes },
      });
    } catch (error) {
      dispatch({ type: "failed", message: toMessage(error) });
    }
  }, []);

  const install = useCallback(async () => {
    const update = found.current;
    if (update === null) return;
    dispatch({ type: "downloadStarted" });
    try {
      await update.install((progress) => {
        dispatch({ type: "progress", progress });
      });
      dispatch({ type: "installed" });
    } catch (error) {
      dispatch({ type: "failed", message: toMessage(error) });
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await restartApp();
    } catch (error) {
      dispatch({ type: "failed", message: toMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV || !canUpdate()) return;
    const first = setTimeout(() => void checkNow(), FIRST_CHECK_DELAY_MS);
    const again = setInterval(() => void checkNow(), CHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  }, [checkNow]);

  return { state, currentVersion: __APP_VERSION__, checkNow, install, restart };
}
