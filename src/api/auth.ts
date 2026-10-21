import { call } from "./call";

/** Mirrors `Provider` in `src-tauri/src/auth/mod.rs`. */
export type Provider = "github" | "discord";

/**
 * Mirrors `AuthUser` in `src-tauri/src/auth/user.rs`. This is everything the interface ever
 * learns about the account: the tokens stay in the Rust side.
 */
export interface AuthUser {
  id: string;
  name: string;
  /** Only ever a URL on the providers' own image hosts (the Rust side filters it). */
  avatarUrl: string | null;
  /** Set by the server: "github" or "discord". */
  provider: string;
}

/** Who is signed in, if anyone. Restores the saved session silently. */
export function currentUser(): Promise<AuthUser | null> {
  return call<AuthUser | null>("current_user");
}

/** Opens the system browser and waits for the learner to sign in. */
export function signIn(provider: Provider, ageConfirmed: boolean): Promise<AuthUser> {
  return call<AuthUser>("sign_in", { provider, ageConfirmed });
}

/** Gives up a sign-in that is waiting for the browser. */
export async function cancelSignIn(): Promise<void> {
  // The Rust command returns `()`, which arrives as `null`.
  await call<null>("cancel_sign_in");
}

export async function signOut(): Promise<void> {
  await call<null>("sign_out");
}
