import { useState } from "react";
import type { Onboarding } from "../api/onboarding";
import { fromProfile, isAnswered, NO_ANSWERS, toProfile } from "../onboarding/answers";
import { STEPS } from "../onboarding/questions";
import { StepOptions } from "./StepOptions";

interface ProfileAnswersProps {
  /** What the learner answered, or `null` if they have not answered yet. */
  profile: Onboarding | null;
  onSave: (profile: Onboarding) => Promise<void>;
}

/**
 * The answers of the first-launch questions, editable at any time. They are what the
 * recommendations rely on, so changing them changes what is suggested.
 */
export function ProfileAnswers({ profile, onSave }: ProfileAnswersProps) {
  const [answers, setAnswers] = useState(profile === null ? NO_ANSWERS : fromProfile(profile));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const complete = STEPS.every((step) => isAnswered(step, answers));

  async function save() {
    const next = toProfile(answers);
    if (next === null) return;
    setState("saving");
    setError(null);
    try {
      await onSave(next);
      setState("saved");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Erreur inconnue.");
      setState("failed");
    }
  }

  return (
    <form
      className="card profile-answers"
      aria-label="Tes préférences"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete && state !== "saving") void save();
      }}
    >
      <div>
        <h3 className="profile-answers-title">Tes préférences</h3>
        <p className="setting-help">
          Ces réponses servent à te recommander des exercices. Change-les quand ton niveau ou tes
          envies évoluent.
        </p>
      </div>
      {STEPS.map((step) => (
        <fieldset key={step.key} className="profile-answers-step">
          <legend className="label">{step.title}</legend>
          <StepOptions
            step={step}
            answers={answers}
            onChange={(next) => {
              setAnswers(next);
              setState("idle");
            }}
          />
        </fieldset>
      ))}
      {error !== null && <p className="alert alert-danger">{error}</p>}
      <div className="button-row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!complete || state === "saving"}
          aria-busy={state === "saving"}
        >
          {state === "saving" ? "Enregistrement…" : "Enregistrer mes préférences"}
        </button>
        {state === "saved" && (
          <p className="hints-intro" role="status">
            Préférences enregistrées.
          </p>
        )}
      </div>
    </form>
  );
}
