import { percent } from "../updates/state";
import type { Updater } from "../updates/useUpdater";

function Status({ updater }: { updater: Updater }) {
  const { state, currentVersion } = updater;
  switch (state.status) {
    case "idle":
      return (
        <p>Version {currentVersion}. L&apos;application cherche toute seule les mises à jour.</p>
      );
    case "checking":
      return <p>Recherche de mises à jour…</p>;
    case "upToDate":
      return <p>SynAck {currentVersion} est à jour.</p>;
    case "available":
      return (
        <p>
          La version <strong className="tabular-nums">{state.version}</strong> est disponible, tu as
          la {currentVersion}.
        </p>
      );
    case "downloading": {
      const done = percent(state);
      return (
        <p className="tabular-nums">
          Téléchargement de la version {state.version}
          {done === null ? "…" : ` : ${String(done)} %`}
        </p>
      );
    }
    case "ready":
      return (
        <p>La version {state.version} est installée. Redémarre SynAck pour l&apos;utiliser.</p>
      );
    case "failed":
      return <p className="alert alert-danger">{state.message}</p>;
  }
}

/** Reglages > Mises à jour : the version, what the updater is doing, and the notes of a new version. */
export function UpdatesSettings({ updater }: { updater: Updater }) {
  const { state } = updater;
  const notes = state.status === "available" || state.status === "downloading" ? state.notes : null;
  const busy = state.status === "checking" || state.status === "downloading";

  return (
    <section className="screen" aria-label="Mises à jour">
      <div className="card setting-row">
        <div className="setting-text">
          <p className="setting-title">Mises à jour</p>
          <div className="setting-help">
            <Status updater={updater} />
          </div>
        </div>
        {state.status === "available" ? (
          <button type="button" className="btn btn-primary" onClick={() => void updater.install()}>
            Installer la {state.version}
          </button>
        ) : state.status === "ready" ? (
          <button type="button" className="btn btn-primary" onClick={() => void updater.restart()}>
            Redémarrer
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            aria-busy={state.status === "checking"}
            onClick={() => void updater.checkNow()}
          >
            Vérifier maintenant
          </button>
        )}
      </div>
      {notes !== null && (
        <div className="card">
          <h3 className="label">
            Nouveautés de la{" "}
            {state.status === "available" || state.status === "downloading" ? state.version : ""}
          </h3>
          <pre className="snippet update-notes">{notes}</pre>
        </div>
      )}
    </section>
  );
}
