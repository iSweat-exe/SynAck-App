import { call } from "./call";

export type Difficulty = "easy" | "medium" | "hard";

/** Mirrors `Example` in `src-tauri/src/exercises.rs`. */
export interface Example {
  input: string;
  output: string;
}

/** Mirrors `Exercise` in `src-tauri/src/exercises.rs`. The hidden tests are not part of it. */
export interface Exercise {
  id: string;
  title: string;
  difficulty: Difficulty;
  summary: string;
  /** Themes the learner can filter on, e.g. "Boucles". */
  topics: string[];
  /** What the exercise is about. Markdown. */
  statement: string;
  /** The format of the input the program receives. Markdown. */
  input: string;
  /** The format of the output the program must print. Markdown. */
  output: string;
  /** Traps and hints worth knowing before starting. Markdown. `null` when there are none. */
  notes: string | null;
  examples: Example[];
  /** Code shown in the editor, by language id. The keys are the languages on offer. */
  starters: Record<string, string>;
}

/** Mirrors `Mode` in `src-tauri/src/check.rs`. */
export type Mode = "examples" | "submit";

/** Mirrors `RunOutput` in `src-tauri/src/runner.rs`. */
export interface RunOutput {
  stdout: string;
  stderr: string;
  /** `null` when the process was killed because of the timeout. */
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

/** Mirrors `LineDiff` in `src-tauri/src/check.rs`: a missing line is `null`. */
export interface LineDiff {
  /** Starts at 1. */
  line: number;
  expected: string | null;
  actual: string | null;
}

/** Mirrors `CaseResult` in `src-tauri/src/check.rs`. */
export interface CaseResult {
  input: string;
  expected: string;
  actual: string;
  stderr: string;
  passed: boolean;
  /** Where the output starts to differ; `null` when it matches. */
  diff: LineDiff | null;
  timedOut: boolean;
  exitCode: number | null;
}

/** Mirrors `HiddenSummary` in `src-tauri/src/check.rs`. */
export interface HiddenSummary {
  total: number;
  passed: number;
  /** The first failures only. */
  failures: CaseResult[];
}

/** Mirrors `CheckReport` in `src-tauri/src/check.rs`. */
export interface CheckReport {
  /** Set when the code does not compile: no test was run. */
  compileError: RunOutput | null;
  examples: CaseResult[];
  /** `null` in `examples` mode, or when an example failed. */
  hidden: HiddenSummary | null;
  /** Decided by the Rust side, which also records it. */
  solved: boolean;
}

/** Mirrors `SolvedEntry` in `src-tauri/src/progress.rs`. */
export interface SolvedEntry {
  exercise: string;
  language: string;
  /** UTC, `YYYY-MM-DD HH:MM:SS`. */
  solvedAt: string;
}

export function listExercises(): Promise<Exercise[]> {
  return call<Exercise[]>("list_exercises");
}

export function getSolved(): Promise<SolvedEntry[]> {
  return call<SolvedEntry[]>("get_solved");
}

export function checkExercise(
  exercise: string,
  language: string,
  code: string,
  mode: Mode,
): Promise<CheckReport> {
  return call<CheckReport>("check_exercise", { exercise, language, code, mode });
}
