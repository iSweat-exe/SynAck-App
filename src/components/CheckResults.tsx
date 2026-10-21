import type { CaseResult, CheckReport, Mode } from "../api/exercises";

/** Long outputs are shown as a window around the wrong line, never as a wall of text. */
const CONTEXT_LINES = 3;
const MAX_LINES = 12;

function visibleRange(total: number, mark: number | null): { from: number; to: number } {
  if (total <= MAX_LINES) return { from: 1, to: total };
  if (mark === null) return { from: 1, to: MAX_LINES };
  return { from: Math.max(1, mark - CONTEXT_LINES), to: Math.min(total, mark + CONTEXT_LINES) };
}

/** One output, numbered line by line, with the first wrong line highlighted. */
function Lines({
  text,
  mark,
  tone,
}: {
  text: string;
  mark: number | null;
  tone: "expected" | "wrong";
}) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const { from, to } = visibleRange(lines.length, mark);
  const before = from - 1;
  const after = lines.length - to;

  return (
    <pre className="snippet lines">
      {before > 0 && <span className="line line-gap">⋯ {before} lignes plus haut</span>}
      {lines.slice(from - 1, to).map((line, offset) => {
        const number = from + offset;
        return (
          // Lines are static text that can repeat, so their number is the identity.
          <span key={number} className={mark === number ? `line line-${tone}` : "line"}>
            <span className="line-number">{number}</span>
            {line || " "}
          </span>
        );
      })}
      {after > 0 && <span className="line line-gap">⋯ {after} lignes plus bas</span>}
    </pre>
  );
}

function describeDifference(result: CaseResult): string {
  if (result.timedOut) return "Temps dépassé : le programme a été arrêté.";
  if (result.exitCode !== 0 && result.exitCode !== null) {
    return "Le programme s'est arrêté sur une erreur.";
  }
  const { diff } = result;
  if (!diff) return "La sortie ne correspond pas.";
  const wanted =
    diff.expected === null ? "rien (la sortie est trop longue)" : `« ${diff.expected} »`;
  const got = diff.actual === null ? "rien (la sortie est trop courte)" : `« ${diff.actual} »`;
  return `Ligne ${String(diff.line)} : attendu ${wanted}, obtenu ${got}.`;
}

interface FailureProps {
  title: string;
  result: CaseResult;
  open: boolean;
}

function Failure({ title, result, open }: FailureProps) {
  const mark = result.diff?.line ?? null;
  return (
    <li>
      <details className="failure" open={open}>
        <summary>
          <span className="badge badge-danger">Échoué</span>
          <span className="failure-title">{title}</span>
        </summary>
        <p className="failure-hint">{describeDifference(result)}</p>
        <div className="comparison">
          <div className="comparison-input">
            <h4 className="label">Entrée</h4>
            <pre className="snippet">{result.input || "(vide)"}</pre>
          </div>
          <div>
            <h4 className="label">Attendu</h4>
            <Lines text={result.expected} mark={mark} tone="expected" />
          </div>
          <div>
            <h4 className="label">Obtenu</h4>
            {result.timedOut ? (
              <pre className="snippet">(arrêté)</pre>
            ) : (
              <Lines
                text={result.actual || "(rien)"}
                mark={result.actual ? mark : null}
                tone="wrong"
              />
            )}
          </div>
        </div>
        {result.stderr && <pre className="snippet snippet-error">{result.stderr}</pre>}
      </details>
    </li>
  );
}

function Passed({ title }: { title: string }) {
  return (
    <li className="passed">
      <span className="badge badge-success">Réussi</span>
      <span>{title}</span>
    </li>
  );
}

function Tally({ label, passed, total }: { label: string; passed: number; total: number }) {
  return (
    <span className={`badge ${passed === total ? "badge-success" : "badge-danger"}`}>
      {label}{" "}
      <span className="tabular-nums">
        {passed}/{total}
      </span>
    </span>
  );
}

interface CheckResultsProps {
  report: CheckReport;
  mode: Mode;
}

export function CheckResults({ report, mode }: CheckResultsProps) {
  if (report.compileError) {
    return (
      <section className="verdict">
        <p className="alert alert-danger">
          Erreur de compilation : le programme n&apos;a pas été lancé.
        </p>
        <pre className="snippet snippet-error">{report.compileError.stderr}</pre>
      </section>
    );
  }

  const { examples, hidden } = report;
  const examplesPassed = examples.filter((result) => result.passed).length;
  const allExamplesPassed = examplesPassed === examples.length;
  const failures = hidden?.failures ?? [];
  const firstFailingExample = examples.findIndex((result) => !result.passed);

  let verdict: string | null = null;
  let verdictIsHint = false;
  if (report.solved) {
    // The success has its own panel (SolvedFeedback).
    verdict = null;
  } else if (mode === "submit" && !allExamplesPassed) {
    verdict = "Un exemple échoue : les tests cachés n'ont pas été lancés. Corrige-le d'abord.";
  } else if (hidden) {
    verdict =
      "Les tests cachés sont tirés au hasard à chaque validation : seule une vraie logique les passe.";
    verdictIsHint = true;
  }

  return (
    <section className="verdict">
      <div className="tallies">
        <Tally label="Exemples" passed={examplesPassed} total={examples.length} />
        {hidden && <Tally label="Tests cachés" passed={hidden.passed} total={hidden.total} />}
      </div>
      {verdict && <p className={verdictIsHint ? "verdict-hint" : "verdict-text"}>{verdict}</p>}

      <ul className="result-list">
        {examples.map((result, position) =>
          result.passed ? (
            <Passed key={result.input} title={`Exemple ${String(position + 1)}`} />
          ) : (
            <Failure
              key={result.input}
              title={`Exemple ${String(position + 1)}`}
              result={result}
              open={position === firstFailingExample}
            />
          ),
        )}
        {failures.map((result, position) => (
          // Random inputs can repeat, so the position is part of the key.
          <Failure
            key={`${String(position)}:${result.input}`}
            title="Test caché"
            result={result}
            open={position === 0}
          />
        ))}
      </ul>
    </section>
  );
}
