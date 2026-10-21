import { useEffect, useRef } from "react";
import type { QuizQuestion, QuizResult } from "../api/protocols";
import { unanswered } from "../protocols/answers";
import { useQuiz } from "../protocols/useQuiz";
import type { Variants } from "motion/react";
import { AnimatedSvg } from "./AnimatedSvg";
import { CheckIcon } from "./CheckIcon";

const KIND_HINT = {
  single: "Une seule réponse",
  multiple: "Plusieurs réponses possibles",
  order: "À remettre en ordre avec les flèches",
} as const;

/** The arrow nudges the way it points when its button is hovered. */
function chevronStates(direction: "up" | "down"): Variants {
  const way = direction === "up" ? -3 : 3;
  return {
    rest: { y: 0, transition: { duration: 0.12 } },
    hover: { y: [0, way, 0], transition: { duration: 0.4 } },
  };
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <AnimatedSvg
      states={chevronStates(direction)}
      className="icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </AnimatedSvg>
  );
}

interface QuestionProps {
  index: number;
  total: number;
  question: QuizQuestion;
  answer: readonly string[];
  disabled: boolean;
  onChoose: (id: string) => void;
  onMove: (position: number, delta: -1 | 1) => void;
}

function Question({ index, total, question, answer, disabled, onChoose, onMove }: QuestionProps) {
  const textOf = (id: string) => question.options.find((option) => option.id === id)?.text ?? "";

  return (
    <fieldset className="card quiz-question" disabled={disabled}>
      <legend className="label tabular-nums">
        Question {index + 1} sur {total} : {KIND_HINT[question.kind]}
      </legend>
      <p className="quiz-prompt">{question.prompt}</p>
      {question.kind === "order" ? (
        <ol className="quiz-order">
          {answer.map((id, position) => (
            <li key={id} className="quiz-order-item">
              <span className="quiz-order-number tabular-nums">{position + 1}</span>
              <span className="quiz-order-text">{textOf(id)}</span>
              <span className="quiz-order-moves">
                <button
                  type="button"
                  className="btn btn-secondary quiz-move"
                  aria-label={`Monter : ${textOf(id)}`}
                  disabled={position === 0}
                  onClick={() => {
                    onMove(position, -1);
                  }}
                >
                  <Chevron direction="up" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary quiz-move"
                  aria-label={`Descendre : ${textOf(id)}`}
                  disabled={position === answer.length - 1}
                  onClick={() => {
                    onMove(position, 1);
                  }}
                >
                  <Chevron direction="down" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="quiz-options">
          {question.options.map((option) => (
            <label key={option.id} className="quiz-option">
              <input
                type={question.kind === "multiple" ? "checkbox" : "radio"}
                name={`question-${String(index)}`}
                checked={answer.includes(option.id)}
                onChange={() => {
                  onChoose(option.id);
                }}
              />
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

interface ResultProps {
  result: QuizResult;
  onRetry: () => void;
  onBack: () => void;
}

function ResultBody({ result, onRetry, onBack }: ResultProps) {
  if (result.validated) {
    return (
      <div className="alert alert-success quiz-verdict" role="status">
        <p className="quiz-verdict-title">
          <CheckIcon draw />
          Protocole validé
        </p>
        <p>
          <span className="tabular-nums">
            {result.correct} / {result.total}
          </span>{" "}
          : toutes les réponses sont justes. Tu peux refaire le quiz quand tu veux, il ne sera pas
          le même.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Voir les autres protocoles
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-failed">
      <div className="alert alert-danger quiz-verdict" role="status">
        <p className="quiz-verdict-title">Pas encore validé</p>
        <p>
          <span className="tabular-nums">
            {result.correct} / {result.total}
          </span>{" "}
          : il faut tout réussir pour valider ce protocole. Relis ce qui t'a échappé, puis
          recommence : les questions, leur formulation et l'ordre des réponses changeront.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Recommencer avec un nouveau quiz
        </button>
      </div>
      <h4 className="label">Ce qu'il fallait répondre</h4>
      <ul className="quiz-review">
        {result.review.map((item, index) =>
          item.ok ? null : (
            <li key={`${String(index)}-${item.prompt ?? ""}`} className="card">
              <p className="label tabular-nums">Question {index + 1}</p>
              <p className="quiz-prompt">{item.prompt}</p>
              <ol className="quiz-answer">
                {(item.correctAnswer ?? []).map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ol>
              {item.explanation !== undefined && <p className="quiz-why">{item.explanation}</p>}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** The verdict is brought into view: the quiz it replaces was longer than the screen. */
function Result(props: ResultProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <div ref={ref} className="quiz-result">
      <ResultBody {...props} />
    </div>
  );
}

interface ProtocolQuizProps {
  protocol: string;
  validated: boolean;
  onValidated: () => void;
  onBack: () => void;
}

/**
 * The end of a protocol: a quiz that has to be passed in full to validate it. It is never the
 * same twice, so that there is no way through but to have understood.
 */
export function ProtocolQuiz({ protocol, validated, onValidated, onBack }: ProtocolQuizProps) {
  const { state, start, choose, reorder, submit } = useQuiz(protocol, onValidated);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="card quiz-intro">
        <p>
          Pour valider {validated ? "à nouveau " : ""}ce protocole, réponds juste à{" "}
          <strong>toutes</strong> les questions. Une seule erreur et il reste non validé. À chaque
          essai, les questions, leur formulation et l'ordre des réponses changent : seule la
          compréhension te fera passer.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={state.status === "loading"}
          aria-busy={state.status === "loading"}
          onClick={() => void start()}
        >
          {state.status === "loading"
            ? "Préparation…"
            : validated
              ? "Refaire le quiz"
              : "Commencer le quiz"}
        </button>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="quiz-intro">
        <p className="alert alert-danger">{state.message}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void start()}>
          Recommencer
        </button>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <Result
        result={state.result}
        onRetry={() => {
          void start();
        }}
        onBack={onBack}
      />
    );
  }

  const missing = unanswered(state.quiz, state.answers);
  const submitting = state.status === "submitting";
  return (
    <form
      className="quiz"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {state.quiz.questions.map((question, index) => (
        <Question
          key={`${String(index)}-${question.prompt}`}
          index={index}
          total={state.quiz.questions.length}
          question={question}
          answer={state.answers[index] ?? []}
          disabled={submitting}
          onChoose={(id) => {
            choose(index, question.kind === "multiple", id);
          }}
          onMove={(position, delta) => {
            reorder(index, position, delta);
          }}
        />
      ))}
      <div className="quiz-submit">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || missing.length > 0}
        >
          {submitting ? "Correction…" : "Valider mes réponses"}
        </button>
        {missing.length > 0 && (
          <p className="verdict-hint" aria-live="polite">
            <span className="tabular-nums">{missing.length}</span>{" "}
            {missing.length > 1 ? "questions sans réponse" : "question sans réponse"}
          </p>
        )}
      </div>
    </form>
  );
}
