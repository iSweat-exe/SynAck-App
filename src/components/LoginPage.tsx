import { useState } from "react";
import type { Provider } from "../api/auth";
import type { AuthState } from "../auth/state";
import { DiscordIcon, GithubIcon } from "./BrandIcons";

interface LoginPageProps {
  state: Extract<AuthState, { status: "signedOut" | "signingIn" }>;
  onSignIn: (provider: Provider, ageConfirmed: boolean) => void;
  onCancel: () => void;
}

const PROVIDERS: readonly { id: Provider; label: string; icon: () => React.ReactNode }[] = [
  { id: "github", label: "GitHub", icon: GithubIcon },
  { id: "discord", label: "Discord", icon: DiscordIcon },
];

/** The first screen of the application: sign in with a provider, in the system browser. */
export function LoginPage({ state, onSignIn, onCancel }: LoginPageProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const waiting = state.status === "signingIn";

  return (
    <main className="login">
      {/* The outline and the hard shadow follow the torn edge: they are drawn on the wrapper. */}
      <div className="ticket-wrap">
        <div className="ticket">
          <header className="ticket-header">
            <p className="wordmark wordmark-large">
              Syn<span className="wordmark-ack">Ack</span>
            </p>
            <p className="ticket-tagline">Apprends à coder en résolvant des exercices.</p>
          </header>

          <section className="ticket-section">
            <h1 className="ticket-title">
              Connexion <span className="badge">Bêta</span>
            </h1>
            <p>Connecte-toi pour enregistrer ta progression.</p>

            <label className="check">
              <input
                type="checkbox"
                checked={ageConfirmed}
                disabled={waiting}
                onChange={(event) => {
                  setAgeConfirmed(event.target.checked);
                }}
              />
              <span>J&apos;ai au moins 15 ans.</span>
            </label>

            <div className="provider-list">
              {PROVIDERS.map(({ id, label, icon: Icon }) => {
                const active = waiting && state.provider === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="btn btn-secondary btn-block"
                    disabled={waiting || !ageConfirmed}
                    aria-busy={active}
                    aria-describedby="login-hint"
                    onClick={() => {
                      onSignIn(id, ageConfirmed);
                    }}
                  >
                    <Icon />
                    {active ? "Connexion en cours…" : `Continuer avec ${label}`}
                  </button>
                );
              })}
            </div>

            <div id="login-hint" aria-live="polite" className="login-status">
              {waiting && (
                <>
                  <p>Termine la connexion dans ton navigateur, puis reviens ici.</p>
                  <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Annuler
                  </button>
                </>
              )}
              {!waiting && !ageConfirmed && (
                <p className="verdict-hint">Confirme ton âge pour continuer.</p>
              )}
              {state.status === "signedOut" && state.notice && (
                <p className="alert alert-danger">{state.notice}</p>
              )}
            </div>
          </section>

          <footer className="ticket-section ticket-footer">
            <p className="verdict-hint">
              La connexion se fait dans ton navigateur : SynAck ne voit jamais ton mot de passe.
            </p>
            <div className="barcode" aria-hidden="true" />
          </footer>
        </div>
      </div>
    </main>
  );
}
