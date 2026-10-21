/**
 * Light or dark. The learner's choice (Settings > Appearance) is remembered on this computer;
 * until they choose, the application follows the operating system.
 */

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "synack-theme";
const listeners = new Set<() => void>();

/** The saved choice if there is one, otherwise what the operating system prefers. */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark ? "dark" : "light";
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Applies the starting theme to the page. Call before the first render, to avoid a flash. */
export function initTheme() {
  apply(resolveTheme(readStored(), window.matchMedia("(prefers-color-scheme: dark)").matches));
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this session if the storage is unavailable.
  }
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}
