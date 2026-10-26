import { useCallback, useEffect, useState } from "react";
import { getOnboarding, saveOnboarding, type Onboarding } from "../api/onboarding";

export type OnboardingState =
  | { status: "loading" }
  | { status: "needed" }
  | { status: "done"; answers: Onboarding }
  // Reading failed: the questions are not worth blocking the app for, so the shell opens anyway.
  | { status: "failed" };

export interface UseOnboarding {
  state: OnboardingState;
  /** What the learner answered, once they did: it can then be edited from the profile. */
  profile: Onboarding | null;
  /** Records the answers, the first time and each time they are edited. */
  save: (profile: Onboarding) => Promise<void>;
}

/** Whether this account has answered the questions, and a way to record its answers. */
export function useOnboarding(userId: string): UseOnboarding {
  const [state, setState] = useState<OnboardingState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getOnboarding()
      .then((answers) => {
        if (!cancelled) {
          setState(answers === null ? { status: "needed" } : { status: "done", answers });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(async (profile: Onboarding) => {
    await saveOnboarding(profile);
    setState({ status: "done", answers: profile });
  }, []);

  return { state, profile: state.status === "done" ? state.answers : null, save };
}
