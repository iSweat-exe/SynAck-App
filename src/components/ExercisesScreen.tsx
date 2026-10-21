import { useState } from "react";
import type { Environment } from "../environment/useEnvironment";
import { distinct, filterExercises, NO_FILTER, type Criteria } from "../exercises/filter";
import { nextUnsolved } from "../exercises/next";
import type { Exercises } from "../exercises/useExercises";
import { navigate } from "../transitions";
import { rewardOf, type Reward } from "../xp";
import { CatalogFilters } from "./CatalogFilters";
import { ExerciseList } from "./ExerciseList";
import { DepthTransition } from "./DepthTransition";
import { ExerciseSolver } from "./ExerciseSolver";

interface ExercisesScreenProps {
  exercises: Exercises;
  environment: Environment;
  onOpenEnvironment: () => void;
  /** Called when an exercise is solved for the first time, before the progress is read again. */
  onReward: (reward: Reward) => void;
  /** The open exercise, kept by the shell so that the breadcrumb can show and leave it. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ExercisesScreen({
  exercises,
  environment,
  onOpenEnvironment,
  onReward,
  selectedId,
  onSelect,
}: ExercisesScreenProps) {
  // The learner's work in progress, kept while they browse: "<exercise>:<language>" -> code.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Kept here, not in the list, so the filters survive opening an exercise and coming back.
  const [criteria, setCriteria] = useState<Criteria>(NO_FILTER);

  const { catalog, solved, refreshSolved } = exercises;
  if (catalog.status === "loading") return <p>Chargement des exercices…</p>;
  if (catalog.status === "failed") return <p className="alert alert-danger">{catalog.message}</p>;

  const languageName = (id: string) => {
    if (environment.state.status !== "ready") return id;
    return environment.state.tools.find((tool) => tool.id === id)?.name ?? id;
  };

  const selected = catalog.exercises.find((exercise) => exercise.id === selectedId);
  if (selected) {
    const draftKey = (language: string) => `${selected.id}:${language}`;
    return (
      <DepthTransition key={selected.id}>
        <ExerciseSolver
          key={selected.id}
          exercise={selected}
          environment={environment}
          solved={solved.some((entry) => entry.exercise === selected.id)}
          getCode={(language) => drafts[draftKey(language)] ?? selected.starters[language] ?? ""}
          setCode={(language, code) => {
            setDrafts((previous) => ({ ...previous, [draftKey(language)]: code }));
          }}
          onBack={() => {
            navigate(() => {
              onSelect(null);
            }, "nav-back");
          }}
          onOpenEnvironment={onOpenEnvironment}
          onSolved={(firstTime) => {
            if (firstTime) onReward(rewardOf(selected.difficulty));
            void refreshSolved();
          }}
          othersSolved={
            [...new Set(solved.map((e) => e.exercise))].filter((id) => id !== selected.id).length
          }
          total={catalog.exercises.length}
          next={nextUnsolved(
            catalog.exercises,
            new Set(solved.map((entry) => entry.exercise)),
            selected.id,
          )}
          onOpenNext={(id) => {
            navigate(() => {
              onSelect(id);
            }, "nav-forward");
          }}
        />
      </DepthTransition>
    );
  }

  const solvedIds = new Set(solved.map((entry) => entry.exercise));
  const visible = filterExercises(catalog.exercises, solvedIds, criteria);

  return (
    <DepthTransition key="list">
      <section className="screen exercises-page">
        <h2>Exercices</h2>
        <div className="exercises-layout">
          <CatalogFilters
            criteria={criteria}
            onChange={setCriteria}
            languages={distinct(catalog.exercises.flatMap((e) => Object.keys(e.starters))).map(
              (id) => ({ value: id, label: languageName(id) }),
            )}
            topics={distinct(catalog.exercises.flatMap((e) => e.topics))}
            resultCount={visible.length}
          />
          <ExerciseList
            exercises={visible}
            solved={solved}
            onOpen={(id) => {
              navigate(() => {
                onSelect(id);
              }, "nav-forward");
            }}
            onReset={() => {
              setCriteria(NO_FILTER);
            }}
          />
        </div>
      </section>
    </DepthTransition>
  );
}
