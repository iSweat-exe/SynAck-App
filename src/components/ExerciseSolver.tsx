import { useEffect, useRef, useState } from "react";
import { checkExercise, type CheckReport, type Exercise, type Mode } from "../api/exercises";
import { LazyCodeEditor } from "../editor/LazyCodeEditor";
import type { Environment } from "../environment/useEnvironment";
import { DIFFICULTY_LABEL } from "../exercises/labels";
import { MAX_CODE_BYTES, codeSize } from "../exercises/codeSize";
import { CheckIcon } from "./CheckIcon";
import { NavIcon } from "./NavIcon";
import { CheckResults } from "./CheckResults";
import { ExerciseHints } from "./ExerciseHints";
import { ExerciseStatement } from "./ExerciseStatement";
import { SolvedFeedback } from "./SolvedFeedback";
import { rewardOf, type Reward } from "../xp";

type CheckState =
  | { status: "idle" }
  | { status: "running"; mode: Mode }
  | { status: "done"; mode: Mode; report: CheckReport; earned: Reward | null }
  | { status: "failed"; message: string };

interface ExerciseSolverProps {
  exercise: Exercise;
  environment: Environment;
  /** Whether the exercise is solved, in any language: which one does not matter. */
  solved: boolean;
  /** How many of the hints the learner asked for. */
  hintsShown: number;
  onRevealHint: () => void;
  getCode: (language: string) => string;
  setCode: (language: string, code: string) => void;
  onBack: () => void;
  onOpenEnvironment: () => void;
  /** Called after a check solved the exercise, so the list can refresh. */
  /** `firstTime` is true when no language of this exercise was solved before. */
  onSolved: (firstTime: boolean) => void;
  /** How many OTHER exercises are solved, and how many exist: for the success message. */
  othersSolved: number;
  total: number;
  /** The exercise to suggest once this one is solved, if any is left. */
  next: Exercise | null;
  onOpenNext: (id: string) => void;
}

export function ExerciseSolver({
  exercise,
  environment,
  solved,
  hintsShown,
  onRevealHint,
  getCode,
  setCode,
  onBack,
  onOpenEnvironment,
  onSolved,
  othersSolved,
  total,
  next,
  onOpenNext,
}: ExerciseSolverProps) {
  const languages = Object.keys(exercise.starters);
  const [languageId, setLanguageId] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const resultsRef = useRef<HTMLDivElement>(null);
  // The code a reset just replaced, kept for a few seconds so that it can be put back.
  const [undo, setUndo] = useState<{ language: string; code: string } | null>(null);

  useEffect(() => {
    if (undo === null) return;
    const timer = setTimeout(() => {
      setUndo(null);
    }, 10_000);
    return () => {
      clearTimeout(timer);
    };
  }, [undo]);

  // The results appear below the editor: bring them into view when a check ends.
  useEffect(() => {
    if (check.status !== "done") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [check]);

  const tools = environment.state.status === "ready" ? environment.state.tools : [];
  const toolFor = (id: string) => tools.find((tool) => tool.id === id);
  const language =
    languages.find((id) => id === languageId) ??
    languages.find((id) => toolFor(id)?.installed) ??
    languages[0];
  if (language === undefined) return null;

  const name = toolFor(language)?.name ?? language;
  const installed = toolFor(language)?.installed === true;
  const running = check.status === "running";
  const size = codeSize(getCode(language));
  const starter = exercise.starters[language] ?? "";
  const canReset = getCode(language) !== starter;
  const justSolved = check.status === "done" && check.report.solved;

  async function run(mode: Mode, currentLanguage: string) {
    // Read before the check: the progress changes as soon as it succeeds.
    const firstTime = !solved;
    setCheck({ status: "running", mode });
    try {
      const report = await checkExercise(
        exercise.id,
        currentLanguage,
        getCode(currentLanguage),
        mode,
      );
      const earned = report.solved && firstTime ? rewardOf(exercise.difficulty) : null;
      setCheck({ status: "done", mode, report, earned });
      if (report.solved) onSolved(firstTime);
    } catch (error) {
      setCheck({
        status: "failed",
        message: error instanceof Error ? error.message : "Erreur inconnue.",
      });
    }
  }

  // Only the code goes back to the starter: the progress is not touched.
  function resetCode(currentLanguage: string) {
    setUndo({ language: currentLanguage, code: getCode(currentLanguage) });
    setCode(currentLanguage, starter);
    setCheck({ status: "idle" });
  }

  function undoReset() {
    if (undo === null) return;
    setCode(undo.language, undo.code);
    setUndo(null);
  }

  return (
    <section className="screen">
      {solved && (
        <div className="solved-banner" role="status">
          <CheckIcon strokeWidth={2.5} />
          <p>
            <strong>Exercice déjà résolu.</strong> Tu peux quand même le refaire pour
            t&apos;entraîner.
          </p>
        </div>
      )}

      <div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Tous les exercices
        </button>
      </div>

      <h2 className="solver-title">
        {exercise.title}
        <span className="badge">{DIFFICULTY_LABEL[exercise.difficulty]}</span>
      </h2>

      <div className="solver-layout">
        <div className="screen">
          <ExerciseStatement exercise={exercise} />
          <ExerciseHints hints={exercise.hints} shown={hintsShown} onReveal={onRevealHint} />
        </div>

        <div className="screen">
          <div className="runner-bar">
            <label htmlFor="language">Langage</label>
            <select
              id="language"
              className="field"
              value={language}
              onChange={(event) => {
                setLanguageId(event.target.value);
                setCheck({ status: "idle" });
                setUndo(null);
              }}
            >
              {languages.map((id) => (
                <option key={id} value={id}>
                  {toolFor(id)?.name ?? id}
                  {toolFor(id)?.installed === true ? "" : " (non installé)"}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary runner-reset"
              disabled={!canReset || running}
              title="Remet le code de départ. Ta progression n'est pas touchée."
              onClick={() => {
                resetCode(language);
              }}
            >
              <NavIcon name="reset" />
              Réinitialiser le code
            </button>
          </div>

          {undo !== null && (
            <p className="alert" role="status">
              Code réinitialisé.
              <button type="button" className="btn btn-secondary" onClick={undoReset}>
                Annuler
              </button>
            </p>
          )}

          <LazyCodeEditor
            value={getCode(language)}
            onChange={(next) => {
              setCode(language, next);
              if (undo !== null) setUndo(null);
            }}
            language={language}
            solved={solved || justSolved}
            label={`Solution en ${name}`}
          />

          <p className={`code-size code-size-${size.level} tabular-nums`}>
            {size.bytes.toLocaleString("fr-FR")} / {MAX_CODE_BYTES.toLocaleString("fr-FR")} octets
            {size.level === "over" && " : trop long, raccourcis ton code pour valider."}
          </p>

          {installed ? (
            <div className="button-row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={running}
                aria-busy={check.status === "running" && check.mode === "examples"}
                onClick={() => void run("examples", language)}
              >
                {check.status === "running" && check.mode === "examples"
                  ? "Test…"
                  : "Tester les exemples"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={running || size.level === "over"}
                aria-busy={check.status === "running" && check.mode === "submit"}
                onClick={() => void run("submit", language)}
              >
                {check.status === "running" && check.mode === "submit" ? "Validation…" : "Valider"}
              </button>
            </div>
          ) : (
            <p className="alert alert-danger">
              {name} n&apos;est pas installé sur cette machine.
              <button type="button" className="btn btn-secondary" onClick={onOpenEnvironment}>
                Voir comment l&apos;installer
              </button>
            </p>
          )}

          <div aria-live="polite" className="screen" ref={resultsRef}>
            {check.status === "failed" && <p className="alert alert-danger">{check.message}</p>}
            {check.status === "done" && check.report.solved && (
              <SolvedFeedback
                reward={check.earned}
                hiddenTests={check.report.hidden?.total ?? 0}
                solvedCount={othersSolved + 1}
                total={total}
                next={next}
                onOpenNext={onOpenNext}
                onBack={onBack}
              />
            )}
            {check.status === "done" && <CheckResults report={check.report} mode={check.mode} />}
          </div>
        </div>
      </div>
    </section>
  );
}
