export interface Crumb {
  label: string;
  /** Absent on the last crumb: it is the page the learner is on. */
  onSelect?: () => void;
}

/** Where the learner is, and the way back up: every crumb but the last one is a button. */
export function Breadcrumb({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Fil d'Ariane">
      <ol>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${String(index)}-${crumb.label}`}>
              {last || crumb.onSelect === undefined ? (
                <span className="breadcrumb-current" aria-current={last ? "page" : undefined}>
                  {crumb.label}
                </span>
              ) : (
                <button type="button" className="breadcrumb-link" onClick={crumb.onSelect}>
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
