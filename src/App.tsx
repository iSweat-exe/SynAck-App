import { useState, ViewTransition, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import type { AuthUser } from "./api/auth";
import { AccountCard } from "./components/AccountCard";
import { ExercisesScreen } from "./components/ExercisesScreen";
import { LoginPage } from "./components/LoginPage";
import { Breadcrumb, type Crumb } from "./components/Breadcrumb";
import { Navbar } from "./components/Navbar";
import { NavbarActions } from "./components/NavbarActions";
import { ProfileScreen } from "./components/ProfileScreen";
import { ProtocolsScreen } from "./components/ProtocolsScreen";
import {
  SETTINGS_SECTION_LABEL,
  SettingsScreen,
  type SettingsSection,
} from "./components/SettingsScreen";
import { NavItem } from "./components/NavItem";
import { PageBackground } from "./components/PageBackground";
import { OnboardingPage } from "./components/OnboardingPage";
import { Sidebar, type SidebarItem } from "./components/Sidebar";
import { useAuth } from "./auth/useAuth";
import { useEnvironment } from "./environment/useEnvironment";
import { useExercises } from "./exercises/useExercises";
import { PROTOCOLS, findProtocol } from "./protocols/catalog";
import { useValidatedProtocols } from "./protocols/useValidatedProtocols";
import { useOnboarding } from "./onboarding/useOnboarding";
import { useUpdater } from "./updates/useUpdater";
import { navigate } from "./transitions";
import { totalCoins, totalXp, type Gain, type Reward } from "./xp";

type ViewId = "exercises" | "protocols" | "settings" | "profile";

/** The click of a placeholder entry: it is disabled, so it never runs. */
const noop = () => undefined;

type MainViewId = "exercises" | "protocols";

interface ShellProps {
  user: AuthUser;
  onSignOut: () => void;
}

/** The application itself. It only exists while someone is signed in: nothing is loaded before. */
function Shell({ user, onSignOut }: ShellProps) {
  const [view, setView] = useState<ViewId>("exercises");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("appearance");
  const environment = useEnvironment();
  const exercises = useExercises();
  // The open exercise and protocol live here, not in their screens, for the breadcrumb.
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const validated = useValidatedProtocols();
  const updater = useUpdater();
  // The reward just earned. It is set before the progress is read again, so that the navbar knows a
  // celebration is coming when the new totals arrive.
  const [gain, setGain] = useState<Gain | null>(null);
  const onReward = (reward: Reward) => {
    setGain((previous) => ({ id: (previous?.id ?? 0) + 1, ...reward }));
  };

  // Moving between sections is lateral: a short fade, no slide, which would imply a direction.
  const goTo = (next: ViewId) => {
    navigate(() => {
      setView(next);
      // Choosing a section lands on its list, also when it is the one already open.
      setExerciseId(null);
      setProtocolId(null);
    });
  };

  const solvedCount = new Set(exercises.solved.map((entry) => entry.exercise)).size;
  const exerciseCount =
    exercises.catalog.status === "ready" ? exercises.catalog.exercises.length : 0;
  const solvedIds = new Set(exercises.solved.map((entry) => entry.exercise));
  const finished = [
    ...(exercises.catalog.status === "ready"
      ? exercises.catalog.exercises.filter((exercise) => solvedIds.has(exercise.id))
      : []),
    ...PROTOCOLS.filter((protocol) => validated.ids.has(protocol.id)),
  ].map((item) => item.difficulty);
  const validatedCount = PROTOCOLS.filter((protocol) => validated.ids.has(protocol.id)).length;

  // The main navigation. Settings has its own button, above the account.
  const views: SidebarItem<MainViewId | "paths" | "courses">[] = [
    { id: "paths", label: "Parcours", icon: "paths", disabled: true },
    { id: "courses", label: "Cours", icon: "courses", disabled: true },
    {
      id: "exercises",
      label: "Exercices",
      icon: "exercises",
      ...(exerciseCount > 0 ? { meta: `${String(solvedCount)}/${String(exerciseCount)}` } : {}),
    },
    {
      id: "protocols",
      label: "Protocoles",
      icon: "protocols",
      meta: `${String(validatedCount)}/${String(PROTOCOLS.length)}`,
    },
  ];

  const exerciseTitle =
    exercises.catalog.status === "ready"
      ? exercises.catalog.exercises.find((exercise) => exercise.id === exerciseId)?.title
      : undefined;
  const protocolName = protocolId === null ? undefined : findProtocol(protocolId)?.name;

  const crumbs: Crumb[] = [];
  if (view === "exercises") {
    const back = () => {
      navigate(() => {
        setExerciseId(null);
      }, "nav-back");
    };
    crumbs.push(
      exerciseTitle === undefined ? { label: "Exercices" } : { label: "Exercices", onSelect: back },
    );
    if (exerciseTitle !== undefined) crumbs.push({ label: exerciseTitle });
  } else if (view === "protocols") {
    const back = () => {
      navigate(() => {
        setProtocolId(null);
      }, "nav-back");
    };
    crumbs.push(
      protocolName === undefined
        ? { label: "Protocoles" }
        : { label: "Protocoles", onSelect: back },
    );
    if (protocolName !== undefined) crumbs.push({ label: protocolName });
  } else if (view === "profile") {
    crumbs.push({ label: "Profil" });
  } else {
    crumbs.push(
      {
        label: "Réglages",
        onSelect: () => {
          goTo("settings");
        },
      },
      { label: SETTINGS_SECTION_LABEL[settingsSection] },
    );
  }

  let page: ReactNode;
  if (view === "exercises") {
    page = (
      <ExercisesScreen
        exercises={exercises}
        environment={environment}
        onReward={onReward}
        selectedId={exerciseId}
        onSelect={setExerciseId}
        onOpenEnvironment={() => {
          setSettingsSection("environment");
          goTo("settings");
        }}
      />
    );
  } else if (view === "protocols") {
    page = (
      <ProtocolsScreen
        onReward={onReward}
        selectedId={protocolId}
        onSelect={setProtocolId}
        validated={validated}
      />
    );
  } else if (view === "profile") {
    page = (
      <ProfileScreen
        user={user}
        solvedCount={solvedCount}
        exerciseCount={exerciseCount}
        onSignOut={onSignOut}
      />
    );
  } else {
    page = (
      <SettingsScreen
        section={settingsSection}
        onSectionChange={setSettingsSection}
        environment={environment}
        updater={updater}
      />
    );
  }

  return (
    <div className="shell">
      <Sidebar
        items={views}
        current={view === "settings" || view === "profile" ? null : view}
        onSelect={(id) => {
          if (id !== "courses" && id !== "paths") goTo(id);
        }}
      >
        <NavItem
          pillId="sidebar-pill"
          icon="settings"
          current={view === "settings"}
          onClick={() => {
            goTo("settings");
          }}
        >
          Réglages
        </NavItem>
        <NavItem pillId="sidebar-pill" icon="admin" disabled current={false} onClick={noop}>
          Administration
        </NavItem>
        <AccountCard
          user={user}
          profileOpen={view === "profile"}
          onOpenProfile={() => {
            goTo("profile");
          }}
        />
      </Sidebar>
      <div className="shell-main">
        <PageBackground page={view} />
        <Navbar>
          <Breadcrumb crumbs={crumbs} />
          <NavbarActions
            xp={totalXp(finished)}
            coins={totalCoins(finished)}
            gain={gain}
            updater={updater}
          />
        </Navbar>
        <main className="content">
          <ViewTransition key={view} default="none" enter="page-in" exit="page-out">
            {page}
          </ViewTransition>
        </main>
      </div>
    </div>
  );
}

/**
 * Between the sign-in and the application: the questions of the first launch. Skipping them only
 * lasts for this session; a failure to read them never blocks the application.
 */
function Gate({ user, onSignOut }: ShellProps) {
  const onboarding = useOnboarding(user.id);
  const [skipped, setSkipped] = useState(false);

  if (onboarding.state.status === "loading") return <Splash />;
  if (onboarding.state.status === "needed" && !skipped) {
    return (
      <OnboardingPage
        onSave={onboarding.save}
        onSkip={() => {
          setSkipped(true);
        }}
      />
    );
  }
  return <Shell user={user} onSignOut={onSignOut} />;
}

/** What the window shows while the saved session is being checked. */
function Splash() {
  return (
    <main className="login">
      <p className="wordmark wordmark-large">
        Syn<span className="wordmark-ack">Ack</span>
      </p>
    </main>
  );
}

export default function App() {
  const auth = useAuth();
  const { state } = auth;

  // The application opens on the login page unless a saved session is still valid.
  if (state.status === "loading") return <Splash />;
  if (state.status === "signedIn") {
    return (
      <MotionConfig reducedMotion="user">
        <Gate
          user={state.user}
          onSignOut={() => {
            void auth.signOut();
          }}
        />
      </MotionConfig>
    );
  }
  return (
    <LoginPage
      state={state}
      onSignIn={(provider, ageConfirmed) => {
        void auth.signIn(provider, ageConfirmed);
      }}
      onCancel={auth.cancelSignIn}
    />
  );
}
