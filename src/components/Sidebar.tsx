import type { ReactNode } from "react";
import type { NavIconName } from "./NavIcon";
import { NavItem } from "./NavItem";

export interface SidebarItem<Id extends string> {
  id: Id;
  label: string;
  icon: NavIconName;
  /** A section that is announced but not built yet. */
  disabled?: boolean;
  /** Where the learner stands in this section, such as "3/15". */
  meta?: string;
}

interface SidebarProps<Id extends string> {
  items: readonly SidebarItem<Id>[];
  /** The item of the current page, or `null` when the page is not one of the items. */
  current: Id | null;
  onSelect: (id: Id) => void;
  /** Shown at the bottom, under the navigation (the settings link and the account). */
  children?: ReactNode;
}

/** The left column, full height: the name of the app, then the main navigation. */
export function Sidebar<Id extends string>({
  items,
  current,
  onSelect,
  children,
}: SidebarProps<Id>) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="wordmark">
          Syn<span className="wordmark-ack">Ack</span>
        </p>
        <span
          className="badge badge-warning"
          title="Version de test : des choses peuvent changer ou casser."
        >
          Pré-alpha
        </span>
      </div>
      <nav aria-label="Navigation principale">
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <NavItem
                pillId="sidebar-pill"
                icon={item.icon}
                disabled={item.disabled === true}
                {...(item.meta === undefined ? {} : { meta: item.meta })}
                current={item.id === current}
                onClick={() => {
                  onSelect(item.id);
                }}
              >
                {item.label}
              </NavItem>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">{children}</div>
    </aside>
  );
}
