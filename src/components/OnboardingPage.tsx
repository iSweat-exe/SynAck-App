import { useEffect, useRef, useState } from "react";
import type { Onboarding } from "../api/onboarding";
import { choose, isAnswered, NO_ANSWERS, toProfile } from "../onboarding/answers";
import { STEPS } from "../onboarding/questions";

interface OnboardingPageProps {
  onSave: (profile: Onboarding) => Promise<void>;
  /** Leaves the questions for this session only: they are asked again at the next launch. */
  onSkip: () => void;
}

/**
 * The questions asked once, after the first sign-in: level, aims, time, way of learning. Nothing
 * uses the answers yet; they are kept to recommend exercises, courses and paths later on.
 */
export function OnboardingPage({ onSave, onSkip }: OnboardingPageProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(NO_ANSWERS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLLegendElement>(null);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // A keyboard user lands on the new question, not on the button they pressed.
  useEffect(() => {
    titleRef.current?.focus();
  }, [index]);

  if (step === undefined) return null;

  async function finish() {
    const profile = toProfile(answers);
    if (profile === null) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(profile);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Erreur inconnue.");
      setSaving(false);
    }
  }

  return (
    <main className="onboarding">
      <form
        className="card onboarding-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isAnswered(step, answers) || saving) return;
          if (last) void finish();
          else setIndex(index + 1);
        }}
      >
        <header className="onboarding-header">
          <p className="wordmark">
            Syn<span className="wordmark-ack">Ack</span>
          </p>
          <p className="onboarding-step tabular-nums">
            Question {index + 1} sur {STEPS.length}
          </p>
        </header>
        <div
          className="onboarding-bar"
          role="progressbar"
          aria-label="Avancement des questions"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={index + 1}
        >
          <span
            className="onboarding-bar-fill"
            style={{ transform: `scaleX(${String((index + 1) / STEPS.length)})` }}
          />
        </div>

        <fieldset className="onboarding-step-fields" key={step.key}>
          <legend className="onboarding-title" tabIndex={-1} ref={titleRef}>
            {step.title}
          </legend>
          <p className="onboarding-help">{step.help}</p>
          <div className="onboarding-options">
            {step.options.map((option) => (
              <label key={option.value} className="quiz-option">
                <input
                  type={step.kind === "multiple" ? "checkbox" : "radio"}
                  name={step.key}
                  checked={answers[step.key].includes(option.value)}
                  onChange={() => {
                    setAnswers(choose(answers, step, option.value));
                  }}
                />
                <span className="onboarding-option-text">
                  <span className="onboarding-option-label">{option.label}</span>
                  {option.hint !== undefined && (
                    <span className="onboarding-option-hint">{option.hint}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error !== null && <p className="alert alert-danger">{error}</p>}

        <div className="onboarding-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={index === 0 || saving}
            onClick={() => {
              setIndex(index - 1);
            }}
          >
            Retour
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isAnswered(step, answers) || saving}
            aria-busy={saving}
          >
            {last ? (saving ? "Enregistrement…" : "Terminer") : "Continuer"}
          </button>
        </div>

        <p className="onboarding-skip">
          <button type="button" className="onboarding-skip-button" onClick={onSkip}>
            Passer pour l&apos;instant
          </button>
          <span>On te reposera ces questions au prochain lancement.</span>
        </p>
      </form>
    </main>
  );
}
