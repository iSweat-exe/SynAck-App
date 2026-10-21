import { describe, expect, it } from "vitest";
import type { AuthUser } from "../api/auth";
import { authReducer, INITIAL_AUTH_STATE, type AuthState } from "./state";

const USER: AuthUser = { id: "u1", name: "Ada", avatarUrl: null, provider: "github" };
const SIGNED_OUT: AuthState = { status: "signedOut", notice: null };
const SIGNING_IN: AuthState = { status: "signingIn", provider: "github" };

describe("authReducer", () => {
  it("starts by checking for a saved session", () => {
    expect(INITIAL_AUTH_STATE).toEqual({ status: "loading" });
  });

  it("signs the learner in straight away when a saved session is restored", () => {
    expect(authReducer(INITIAL_AUTH_STATE, { type: "restored", user: USER })).toEqual({
      status: "signedIn",
      user: USER,
    });
  });

  it("shows the login page when there is no saved session", () => {
    expect(authReducer(INITIAL_AUTH_STATE, { type: "restored", user: null })).toEqual(SIGNED_OUT);
  });

  it("shows the login page with an explanation when the saved session could not be checked", () => {
    const state = authReducer(INITIAL_AUTH_STATE, { type: "restoreFailed", message: "Hors ligne" });
    expect(state).toEqual({ status: "signedOut", notice: "Hors ligne" });
  });

  it("waits for the browser once a provider is chosen", () => {
    expect(authReducer(SIGNED_OUT, { type: "signInStarted", provider: "discord" })).toEqual({
      status: "signingIn",
      provider: "discord",
    });
  });

  it("ignores a second sign-in while one is waiting", () => {
    expect(authReducer(SIGNING_IN, { type: "signInStarted", provider: "discord" })).toBe(
      SIGNING_IN,
    );
  });

  it("signs the learner in when the browser sign-in succeeds", () => {
    expect(authReducer(SIGNING_IN, { type: "signedIn", user: USER })).toEqual({
      status: "signedIn",
      user: USER,
    });
  });

  it("does not sign anyone in when a late answer arrives after the sign-in was cancelled", () => {
    expect(authReducer(SIGNED_OUT, { type: "signedIn", user: USER })).toBe(SIGNED_OUT);
  });

  it("goes back to the login page with the reason when the sign-in fails", () => {
    expect(authReducer(SIGNING_IN, { type: "signInFailed", message: "Refusée" })).toEqual({
      status: "signedOut",
      notice: "Refusée",
    });
  });

  it("goes back to the login page without any message when the learner cancels", () => {
    expect(authReducer(SIGNING_IN, { type: "signInFailed", message: null })).toEqual(SIGNED_OUT);
  });

  it("returns to the login page when the learner signs out", () => {
    const signedIn: AuthState = { status: "signedIn", user: USER };
    expect(authReducer(signedIn, { type: "signedOut", notice: null })).toEqual(SIGNED_OUT);
  });
});
