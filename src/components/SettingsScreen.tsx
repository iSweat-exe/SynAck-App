import type { Environment } from "../environment/useEnvironment";
import { EnvironmentScreen } from "./EnvironmentScreen";
import { SubNav, type SubNavItem } from "./SubNav";
import { ThemeSwitch } from "./ThemeSwitch";
import { UpdatesSettings } from "./UpdatesSettings";
import type { Updater } from "../updates/useUpdater";

export type SettingsSection = "appearance" | "environment" | "updates";

const SECTIONS: readonly SubNavItem<SettingsSection>[] = [
  { id: "appearance", label: "Apparence" },
  { id: "environment", label: "Environnement" },
  { id: "updates", label: "Mises à jour" },
];

export const SETTINGS_SECTION_LABEL: Record<SettingsSection, string> = {
  appearance: "Apparence",
  environment: "Environnement",
  updates: "Mises à jour",
};

function AppearanceSettings() {
  return (
    <section className="screen" aria-label="Apparence">
      <div className="card setting-row">
        <div className="setting-text">
          <p className="setting-title">Thème</p>
          <p className="setting-help">
            Clair ou sombre. Ton choix est mémorisé sur cet ordinateur.
          </p>
        </div>
        <ThemeSwitch />
      </div>
    </section>
  );
}

interface SettingsScreenProps {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  environment: Environment;
  updater: Updater;
}

/** The settings of the application: its appearance, and the tools it runs code with. */
export function SettingsScreen({
  section,
  onSectionChange,
  environment,
  updater,
}: SettingsScreenProps) {
  return (
    <section className="screen">
      <h2>Réglages</h2>
      <SubNav
        label="Sections des réglages"
        items={SECTIONS}
        current={section}
        onSelect={onSectionChange}
      />
      {section === "appearance" && <AppearanceSettings />}
      {section === "environment" && <EnvironmentScreen {...environment} />}
      {section === "updates" && <UpdatesSettings updater={updater} />}
    </section>
  );
}
