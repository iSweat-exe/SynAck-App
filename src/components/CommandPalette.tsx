import { useEffect, useId, useRef, useState } from "react";
import type { Exercise } from "../api/exercises";
import { PROTOCOLS } from "../protocols/catalog";
import {
  buildEntries,
  KIND_LABEL,
  searchEntries,
  type SearchEntry,
  type SearchTarget,
} from "../search/search";

interface PaletteBodyProps {
  exercises: readonly Exercise[];
  onSelect: (target: SearchTarget) => void;
}

/** The input and the results. It is mounted when the palette opens, so it always starts empty. */
function PaletteBody({ exercises, onSelect }: PaletteBodyProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const activeRef = useRef<HTMLLIElement>(null);

  const results: SearchEntry[] = searchEntries(buildEntries(exercises, PROTOCOLS), query);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  // The highlighted result stays in view while the arrows move through a long list.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [current, query]);

  const choose = (item: SearchEntry | undefined) => {
    if (item !== undefined) onSelect(item.target);
  };

  return (
    <>
      <input
        type="search"
        className="field palette-input"
        placeholder="Chercher un exercice, un protocole, une page…"
        aria-label="Rechercher"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={results.length > 0 ? `${listId}-${String(current)}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive(results.length === 0 ? 0 : (current + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(results.length === 0 ? 0 : (current - 1 + results.length) % results.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(results[current]);
          }
        }}
      />
      {results.length === 0 ? (
        <p className="palette-empty" role="status">
          Rien ne correspond à « {query.trim()} ».
        </p>
      ) : (
        <ul className="palette-results" role="listbox" id={listId} aria-label="Résultats">
          {results.map((item, position) => (
            <li
              key={item.key}
              id={`${listId}-${String(position)}`}
              ref={position === current ? activeRef : undefined}
              role="option"
              aria-selected={position === current}
              className="palette-result"
              onMouseMove={() => {
                setActive(position);
              }}
              onClick={() => {
                choose(item);
              }}
            >
              <span className="palette-result-text">
                <span className="palette-result-title">{item.title}</span>
                <span className="palette-result-detail">{item.detail}</span>
              </span>
              <span className="badge">{KIND_LABEL[item.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface CommandPaletteProps {
  open: boolean;
  exercises: readonly Exercise[];
  onSelect: (target: SearchTarget) => void;
  onClose: () => void;
}

/**
 * The search (Ctrl K): a window over the application, with a field and the exercises, protocols
 * and pages that match. It is a native `<dialog>`, so the browser keeps the focus inside it and
 * closes it on Escape. Arrows move through the results, Enter opens one.
 */
export function CommandPalette({ open, exercises, onSelect, onClose }: CommandPaletteProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Recherche"
      onClose={onClose}
      // A click on the dark area around the window lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && <PaletteBody exercises={exercises} onSelect={onSelect} />}
    </dialog>
  );
}
