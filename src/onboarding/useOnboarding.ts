import { useCallback, useEffect, useState } from "react";
import { getOnboarding, saveOnboarding, type Onboarding } from "../api/onboarding";

export type OnboardingState =
  | { status: "loading" }
  | { status: "needed" }
  | { status: "done" }
  // Reading failed: the questions are not worth blocking the app for, so the shell opens anyway.
  | { status: "failed" };

export interface UseOnboarding {
  state: OnboardingState;
  save: (profile: Onboarding) => Promise<void>;
}

/** Whether this account has answered the questions, and a way to record its answers. */
export function useOnboarding(userId: string): UseOnboarding {
  const [state, setState] = useState<OnboardingState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getOnboarding()
      .then((answers) => {
        if (!cancelled) setState({ status: answers === null ? "needed" : "done" });
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
    setState({ status: "done" });
  }, []);

  return { state, save };
}
