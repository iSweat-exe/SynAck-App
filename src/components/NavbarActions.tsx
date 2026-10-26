import { useState } from "react";
import { setTheme, useTheme } from "../theme/theme";
import type { Gain } from "../xp";
import { CoinCounter } from "./CoinCounter";
import { NavIcon } from "./NavIcon";
import type { Updater } from "../updates/useUpdater";
import { ShopDialog } from "./ShopDialog";
import { UpdateButton } from "./UpdateButton";
import { XpBar } from "./XpBar";

const SOON = "Bientôt disponible";

interface NavbarActionsProps {
  xp: number;
  coins: number;
  /** Days in a row with an exercise solved or a protocol validated. */
  streak: number;
  /** The reward just earned, if any, for the XP bar and the coins to celebrate. */
  gain: Gain | null;
  updater: Updater;
}

/**
 * The right of the navbar, in this order: the tool (search), the progress (level, streak, coins, bonuses), then the system buttons (notifications, theme). The XP bar, the streak, the coins and the theme button work today: the others are placeholders, greyed
 * out and labelled, so that nobody takes them for a bug. Each one is a feature to build later.
 */
export function NavbarActions({ xp, coins, streak, gain, updater }: NavbarActionsProps) {
  const dark = useTheme() === "dark";
  const [shopOpen, setShopOpen] = useState(false);

  return (
    <div className="navbar-actions">
      <UpdateButton updater={updater} />
      <button type="button" className="navbar-search" disabled title={SOON}>
        <NavIcon name="search" />
        <span>Rechercher</span>
        <kbd>Ctrl K</kbd>
      </button>
      <XpBar xp={xp} gain={gain} />
      <span
        className="navbar-streak tabular-nums"
        data-active={streak > 0}
        title="Série : jours de suite avec au moins un exercice résolu ou un protocole validé"
      >
        <NavIcon name="flame" />
        {streak} {streak > 1 ? "jours" : "jour"}
      </span>
      <CoinCounter
        coins={coins}
        gain={gain}
        onOpen={() => {
          setShopOpen(true);
        }}
      />
      <button
        type="button"
        className="icon-button"
        disabled
        title="Bonus : double XP, gel de série. Bientôt disponible"
        aria-label="Bonus"
      >
        <NavIcon name="gift" />
      </button>
      <button
        type="button"
        className="icon-button"
        disabled
        title={SOON}
        aria-label="Notifications"
      >
        <NavIcon name="bell" />
      </button>
      <button
        type="button"
        className="icon-button"
        title={dark ? "Passer au thème clair" : "Passer au thème sombre"}
        aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
        onClick={() => {
          setTheme(dark ? "light" : "dark");
        }}
      >
        <NavIcon name={dark ? "sun" : "moon"} />
      </button>
      <ShopDialog
        open={shopOpen}
        coins={coins}
        onClose={() => {
          setShopOpen(false);
        }}
      />
    </div>
  );
}
