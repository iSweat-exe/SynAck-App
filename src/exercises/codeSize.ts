/** Mirrors `MAX_CODE_BYTES` in `src-tauri/src/check.rs`: the Rust side is the one that refuses. */
export const MAX_CODE_BYTES = 20_000;

export type CodeSizeLevel = "ok" | "near" | "over";

export interface CodeSize {
  bytes: number;
  level: CodeSizeLevel;
}

/** How big the code is, in the bytes the Rust side counts, and how close it is to the limit. */
export function codeSize(code: string): CodeSize {
  const bytes = new TextEncoder().encode(code).length;
  if (bytes > MAX_CODE_BYTES) return { bytes, level: "over" };
  return { bytes, level: bytes >= MAX_CODE_BYTES * 0.9 ? "near" : "ok" };
}
