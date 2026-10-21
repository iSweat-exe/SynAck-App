import type { ReactNode } from "react";
import { motion } from "motion/react";
import { NavIcon, type NavIconName } from "./NavIcon";

interface NavItemProps {
  /** True for the item of the current page. */
  current: boolean;
  onClick: () => void;
  /** Items that share a pill id share one pill: it glides from the old item to the new one. */
  pillId: string;
  icon?: NavIconName;
  /** A placeholder for a section that does not exist yet: greyed out and labelled. */
  disabled?: boolean;
  /** A short figure shown at the right, such as "3/15". */
  meta?: string;
  children: ReactNode;
}

/** A navigation button. The highlight under the current item moves to the next one on click. */
export function NavItem({
  current,
  onClick,
  pillId,
  icon,
  disabled = false,
  meta,
  children,
}: NavItemProps) {
  return (
    <button
      type="button"
      className="nav-item"
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      title={disabled ? "Bientôt disponible" : undefined}
      onClick={onClick}
    >
      {current && (
        <motion.span
          layoutId={pillId}
          className="nav-pill"
          transition={{ type: "spring", duration: 0.35, bounce: 0.12 }}
        />
      )}
      {icon !== undefined && <NavIcon name={icon} />}
      <span className="nav-item-label">{children}</span>
      {meta !== undefined && <span className="nav-item-meta tabular-nums">{meta}</span>}
    </button>
  );
}
