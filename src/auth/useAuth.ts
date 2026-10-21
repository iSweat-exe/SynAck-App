import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  cancelSignIn,
  currentUser,
  signIn as signInRequest,
  signOut as signOutRequest,
  type Provider,
} from "../api/auth";
import { authReducer, INITIAL_AUTH_STATE, type AuthState } from "./state";

export interface Auth {
  state: AuthState;
  signIn: (provider: Provider, ageConfirmed: boolean) => Promise<void>;
  cancelSignIn: () => void;
  signOut: () => Promise<void>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

/** The sign-in state of the application. The tokens never reach this side: only the account. */
export function useAuth(): Auth {
  const [state, dispatch] = useReducer(authReducer, INITIAL_AUTH_STATE);
  // Set when the learner gives up: the failure that follows is then not an error to show.
  const cancelled = useRef(false);
  // Read through a function: TypeScript would otherwise assume the value set a few lines above.
  const wasCancelled = () => cancelled.current;

  useEffect(() => {
    let stale = false;
    currentUser()
      .then((user) => {
        if (!stale) dispatch({ type: "restored", user });
      })
      .catch((error: unknown) => {
        if (!stale) dispatch({ type: "restoreFailed", message: toMessage(error) });
      });
    return () => {
      stale = true;
    };
  }, []);

  const signIn = useCallback(async (provider: Provider, ageConfirmed: boolean) => {
    cancelled.current = false;
    dispatch({ type: "signInStarted", provider });
    try {
      dispatch({ type: "signedIn", user: await signInRequest(provider, ageConfirmed) });
    } catch (error) {
      dispatch({
        type: "signInFailed",
        message: wasCancelled() ? null : toMessage(error),
      });
    }
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    void cancelSignIn();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
      dispatch({ type: "signedOut", notice: null });
    } catch (error) {
      // The session is closed in the app, but the saved token could not be wiped: say so.
      dispatch({ type: "signedOut", notice: toMessage(error) });
    }
  }, []);

  return { state, signIn, cancelSignIn: cancel, signOut };
}
