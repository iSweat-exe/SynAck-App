import type { AuthUser, Provider } from "../api/auth";

/** Where the application is in the sign-in life cycle. */
export type AuthState =
  | { status: "loading" }
  /** `notice` explains why the learner is on the login page, if something went wrong. */
  | { status: "signedOut"; notice: string | null }
  | { status: "signingIn"; provider: Provider }
  | { status: "signedIn"; user: AuthUser };

export type AuthAction =
  | { type: "restored"; user: AuthUser | null }
  | { type: "restoreFailed"; message: string }
  | { type: "signInStarted"; provider: Provider }
  | { type: "signedIn"; user: AuthUser }
  /** `message` is `null` when the learner cancelled: that is not an error to display. */
  | { type: "signInFailed"; message: string | null }
  | { type: "signedOut"; notice: string | null };

export const INITIAL_AUTH_STATE: AuthState = { status: "loading" };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "restored":
      return action.user
        ? { status: "signedIn", user: action.user }
        : { status: "signedOut", notice: null };
    case "restoreFailed":
      return { status: "signedOut", notice: action.message };
    case "signInStarted":
      // Only a signed-out learner can start a sign-in.
      return state.status === "signedOut"
        ? { status: "signingIn", provider: action.provider }
        : state;
    case "signedIn":
      return state.status === "signingIn" ? { status: "signedIn", user: action.user } : state;
    case "signInFailed":
      return state.status === "signingIn" ? { status: "signedOut", notice: action.message } : state;
    case "signedOut":
      return { status: "signedOut", notice: action.notice };
  }
}
