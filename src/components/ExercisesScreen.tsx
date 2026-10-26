import { useState } from "react";
import type { Environment } from "../environment/useEnvironment";
import type { Onboarding } from "../api/onboarding";
import { draftKey, inProgressIds } from "../exercises/drafts";
import {
  distinct,
  filterExercises,
  isFiltering,
  NO_FILTER,
  type Criteria,
} from "../exercises/filter";
import { recommend } from "../exercises/recommend";
import { nextUnsolved } from "../exercises/next";
import type { Drafts } from "../exercises/useDrafts";
import type { Exercises } from "../exercises/useExercises";
import { navigate } from "../transitions";
import { rewardOf, type Reward } from "../xp";
import { CatalogFilters } from "./CatalogFilters";
import { ExerciseList } from "./ExerciseList";
import { DepthTransition } from "./DepthTransition";
import { ExerciseSolver } from "./ExerciseSolver";
import { Recommendations } from "./Recommendations";

interface ExercisesScreenProps {
  exercises: Exercises;
  /** The code the learner wrote, kept while they browse and between launches. */
  drafts: Drafts;
  /** What the learner answered in the first-launch questions: the recommendations rely on it. */
  profile: Onboarding | null;
  /** Opens the profile, where the answers can be given or changed. */
  onOpenProfile: () => void;
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
  drafts,
  profile,
  onOpenProfile,
  environment,
  onOpenEnvironment,
  onReward,
  selectedId,
  onSelect,
}: ExercisesScreenProps) {
  // Kept here, not in the list, so the filters survive opening an exercise and coming back.
  const [criteria, setCriteria] = useState<Criteria>(NO_FILTER);
  // The hints already asked for, by exercise: leaving an exercise does not hide them again.
  const [hintsShown, setHintsShown] = useState<Record<string, number>>({});

  const { catalog, solved, refreshSolved } = exercises;
  if (catalog.status === "loading") return <p>Chargement des exercices…</p>;
  if (catalog.status === "failed") return <p className="alert alert-danger">{catalog.message}</p>;

  const languageName = (id: string) => {
    if (environment.state.status !== "ready") return id;
    return environment.state.tools.find((tool) => tool.id === id)?.name ?? id;
  };

  const selected = catalog.exercises.find((exercise) => exercise.id === selectedId);
  if (selected) {
    return (
      <DepthTransition key={selected.id}>
        <ExerciseSolver
          key={selected.id}
          exercise={selected}
          environment={environment}
          solved={solved.some((entry) => entry.exercise === selected.id)}
          hintsShown={hintsShown[selected.id] ?? 0}
          onRevealHint={() => {
            setHintsShown((previous) => ({
              ...previous,
              [selected.id]: Math.min((previous[selected.id] ?? 0) + 1, selected.hints.length),
            }));
          }}
          getCode={(language) =>
            drafts.record[draftKey(selected.id, language)] ?? selected.starters[language] ?? ""
          }
          setCode={(language, code) => {
            drafts.set(selected.id, language, code);
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
  const started = inProgressIds(catalog.exercises, solvedIds, drafts.record);
  const visible = filterExercises(catalog.exercises, solvedIds, criteria, started);
  const open = (id: string) => {
    navigate(() => {
      onSelect(id);
    }, "nav-forward");
  };

  return (
    <DepthTransition key="list">
      <section className="screen exercises-page">
        <h2>Exercices</h2>
        {!isFiltering(criteria) &&
          (profile === null ? (
            <aside className="card recommendations" aria-label="Recommandations">
              <h3 className="label">Recommandé pour toi</h3>
              <p className="hints-intro">
                Réponds à quelques questions sur ton niveau et tes envies : on te suggérera les
                exercices qui te correspondent.
              </p>
              <div>
                <button type="button" className="btn btn-secondary" onClick={onOpenProfile}>
                  Répondre aux questions
                </button>
              </div>
            </aside>
          ) : (
            <Recommendations
              items={recommend(profile, catalog.exercises, solvedIds, started)}
              onOpen={open}
            />
          ))}
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
            inProgress={started}
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
