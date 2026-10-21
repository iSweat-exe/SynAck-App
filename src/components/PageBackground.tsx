export type BackgroundId = "exercises" | "protocols" | "profile" | "settings";

/**
 * A very slow pattern behind the page, different for each page. It drifts by one tile over a long
 * time, so that nothing in it pulls the eye away from the content. It never takes a click.
 */
export function PageBackground({ page }: { page: BackgroundId }) {
  // Keyed by page: a new page fades its own pattern in instead of swapping it.
  return (
    <div key={page} className={`page-bg page-bg-${page}`} aria-hidden="true">
      <div className="page-bg-layer" />
    </div>
  );
}
