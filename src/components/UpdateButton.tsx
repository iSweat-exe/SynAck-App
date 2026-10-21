import { percent } from "../updates/state";
import type { Updater } from "../updates/useUpdater";
import { CheckIcon } from "./CheckIcon";
import { NavIcon } from "./NavIcon";

/**
 * The update button, in the navbar. It is always there: quiet with the version number when there is
 * nothing to do, and the loudest thing in the bar (pink, with the new version) when an update is
 * waiting. Nothing is downloaded or restarted without a click on it.
 */
export function UpdateButton({ updater }: { updater: Updater }) {
  const { state, currentVersion } = updater;

  if (state.status === "available") {
    return (
      <button
        type="button"
        className="update-button"
        data-state="available"
        title={`SynAck ${state.version} est disponible : installer maintenant`}
        onClick={() => void updater.install()}
      >
        <NavIcon name="download" />
        <span className="update-text">Mettre à jour</span>
        <span className="update-version tabular-nums">v{state.version}</span>
      </button>
    );
  }

  if (state.status === "downloading") {
    const done = percent(state);
    return (
      <button
        type="button"
        className="update-button"
        data-state="downloading"
        disabled
        aria-busy="true"
        title={`Téléchargement de SynAck ${state.version}`}
      >
        <span
          className="update-progress"
          style={{ transform: `scaleX(${String((done ?? 0) / 100)})` }}
          aria-hidden="true"
        />
        <span className="update-text update-above">
          Téléchargement{done === null ? "…" : ` ${String(done)} %`}
        </span>
      </button>
    );
  }

  if (state.status === "ready") {
    return (
      <button
        type="button"
        className="update-button"
        data-state="ready"
        title="La mise à jour est installée : redémarre SynAck pour l'utiliser"
        onClick={() => void updater.restart()}
      >
        <NavIcon name="refresh" />
        <span className="update-text">Redémarrer</span>
        <span className="update-version tabular-nums">v{state.version}</span>
      </button>
    );
  }

  if (state.status === "checking") {
    return (
      <button
        type="button"
        className="update-button"
        data-state="checking"
        disabled
        aria-busy="true"
        title="Recherche de mises à jour"
      >
        <span className="update-text">Recherche…</span>
      </button>
    );
  }

  if (state.status === "failed") {
    return (
      <button
        type="button"
        className="update-button"
        data-state="failed"
        title={`${state.message} Cliquer pour réessayer.`}
        onClick={() => void updater.checkNow()}
      >
        <NavIcon name="refresh" />
        <span className="update-text">Réessayer</span>
      </button>
    );
  }

  const upToDate = state.status === "upToDate";
  return (
    <button
      type="button"
      className="update-button"
      data-state={upToDate ? "upToDate" : "idle"}
      title={`SynAck ${currentVersion}${upToDate ? " est à jour" : ""}. Vérifier les mises à jour.`}
      onClick={() => void updater.checkNow()}
    >
      {upToDate ? <CheckIcon /> : <NavIcon name="refresh" />}
      <span className="update-text tabular-nums">{upToDate ? "À jour" : `v${currentVersion}`}</span>
    </button>
  );
}
