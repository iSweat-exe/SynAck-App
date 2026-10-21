import type { ToolStatus } from "../api/environment";
import type { Environment } from "../environment/useEnvironment";

function ToolCard({ tool }: { tool: ToolStatus }) {
  return (
    <li className="card">
      <h3 className="card-title">
        {tool.name}
        <span className={`badge ${tool.installed ? "badge-success" : "badge-warning"}`}>
          {tool.installed ? "Installé" : "Manquant"}
        </span>
      </h3>
      {tool.installed ? (
        <p className="card-detail">
          {tool.version}
          <br />
          {tool.path}
        </p>
      ) : (
        tool.install && (
          <>
            <ol>
              {tool.install.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="card-detail">Site officiel : {tool.install.url}</p>
          </>
        )
      )}
    </li>
  );
}

export function EnvironmentScreen({ state, recheck }: Environment) {
  return (
    <section className="screen" aria-label="Environnement">
      <p>SynAck utilise les compilateurs installés sur ta machine.</p>
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={recheck}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? "Vérification…" : "Revérifier"}
        </button>
      </div>
      <div aria-live="polite">
        {state.status === "failed" && <p className="alert alert-danger">{state.message}</p>}
        {state.status === "ready" && (
          <ul className="tools">
            {state.tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
