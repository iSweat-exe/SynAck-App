import { call } from "./call";

/** Mirrors `InstallGuide` in `src-tauri/src/languages.rs`. */
export interface InstallGuide {
  url: string;
  steps: string[];
}

/** Mirrors `ToolStatus` in `src-tauri/src/languages.rs`. */
export interface ToolStatus {
  id: string;
  name: string;
  installed: boolean;
  path: string | null;
  version: string | null;
  /** How to install the tool on this OS; only present when it is missing. */
  install: InstallGuide | null;
}

export function checkEnvironment(): Promise<ToolStatus[]> {
  return call<ToolStatus[]>("check_environment");
}
