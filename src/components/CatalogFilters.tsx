import type { Difficulty } from "../api/exercises";
import { DIFFICULTY_LABEL } from "../exercises/labels";
import { isFiltering, NO_FILTER, type Criteria, type Status } from "../exercises/filter";

interface ChipOption<Value extends string> {
  value: Value;
  label: string;
}

interface ChipGroupProps<Value extends string> {
  legend: string;
  options: readonly ChipOption<Value>[];
  selected: readonly Value[];
  onToggle: (value: Value) => void;
}

/** Toggle chips: pink when pressed. Several can be pressed, they are alternatives. */
function ChipGroup<Value extends string>({
  legend,
  options,
  selected,
  onToggle,
}: ChipGroupProps<Value>) {
  return (
    <fieldset className="filter-group">
      <legend className="label">{legend}</legend>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="chip"
            aria-pressed={selected.includes(option.value)}
            onClick={() => {
              onToggle(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function toggle<Value>(values: readonly Value[], value: Value): Value[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const DIFFICULTIES: readonly ChipOption<Difficulty>[] = (["easy", "medium", "hard"] as const).map(
  (value) => ({ value, label: DIFFICULTY_LABEL[value] }),
);

/** The words of the panel, which change with what is browsed. */
export interface FilterCopy {
  searchPlaceholder: string;
  /** "exercice" / "exercices", for the count. */
  one: string;
  many: string;
  todo: string;
  done: string;
  /** The label of the "started, not finished" status; absent when the catalog has no such thing. */
  progress?: string;
}

export const EXERCISE_COPY: FilterCopy = {
  searchPlaceholder: "Titre, thème…",
  one: "exercice",
  many: "exercices",
  todo: "À faire",
  done: "Résolus",
  progress: "En cours",
};

export const PROTOCOL_COPY: FilterCopy = {
  searchPlaceholder: "Nom, thème…",
  one: "protocole",
  many: "protocoles",
  todo: "À valider",
  done: "Validés",
};

function statuses(copy: FilterCopy): readonly ChipOption<Status>[] {
  return [
    { value: "all", label: "Tous" },
    { value: "todo", label: copy.todo },
    ...(copy.progress === undefined ? [] : [{ value: "progress" as const, label: copy.progress }]),
    { value: "solved", label: copy.done },
  ];
}

interface CatalogFiltersProps {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  languages: readonly ChipOption<string>[];
  topics: readonly string[];
  /** How many items match, announced to screen readers. */
  resultCount: number;
  copy?: FilterCopy;
}

export function CatalogFilters({
  criteria,
  onChange,
  languages,
  topics,
  resultCount,
  copy = EXERCISE_COPY,
}: CatalogFiltersProps) {
  return (
    <aside className="filters card" aria-label="Filtres">
      <div className="filter-group">
        <label className="label" htmlFor="catalog-search">
          Recherche
        </label>
        <input
          id="catalog-search"
          type="search"
          className="field"
          placeholder={copy.searchPlaceholder}
          value={criteria.query}
          onChange={(event) => {
            onChange({ ...criteria, query: event.target.value });
          }}
        />
      </div>

      <ChipGroup
        legend="Difficulté"
        options={DIFFICULTIES}
        selected={criteria.difficulties}
        onToggle={(value) => {
          onChange({ ...criteria, difficulties: toggle(criteria.difficulties, value) });
        }}
      />

      {languages.length > 0 && (
        <ChipGroup
          legend="Langage"
          options={languages}
          selected={criteria.languages}
          onToggle={(value) => {
            onChange({ ...criteria, languages: toggle(criteria.languages, value) });
          }}
        />
      )}

      <ChipGroup
        legend="Thème"
        options={topics.map((topic) => ({ value: topic, label: topic }))}
        selected={criteria.topics}
        onToggle={(value) => {
          onChange({ ...criteria, topics: toggle(criteria.topics, value) });
        }}
      />

      <fieldset className="filter-group">
        <legend className="label">Statut</legend>
        <div className="chips">
          {statuses(copy).map((status) => (
            <button
              key={status.value}
              type="button"
              className="chip"
              aria-pressed={criteria.status === status.value}
              onClick={() => {
                onChange({ ...criteria, status: status.value });
              }}
            >
              {status.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="filter-footer">
        <p className="verdict-hint" aria-live="polite">
          <span className="tabular-nums">{resultCount}</span>{" "}
          {resultCount > 1 ? copy.many : copy.one}
        </p>
        {isFiltering(criteria) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onChange(NO_FILTER);
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>
    </aside>
  );
}
