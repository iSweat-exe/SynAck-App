import { choose, type Answers } from "../onboarding/answers";
import type { Step } from "../onboarding/questions";

interface StepOptionsProps {
  step: Step;
  answers: Answers;
  onChange: (next: Answers) => void;
}

/** The choices of one question: radio buttons for one answer, checkboxes for several. */
export function StepOptions({ step, answers, onChange }: StepOptionsProps) {
  return (
    <div className="onboarding-options">
      {step.options.map((option) => (
        <label key={option.value} className="quiz-option">
          <input
            type={step.kind === "multiple" ? "checkbox" : "radio"}
            name={step.key}
            checked={answers[step.key].includes(option.value)}
            onChange={() => {
              onChange(choose(answers, step, option.value));
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
  );
}
