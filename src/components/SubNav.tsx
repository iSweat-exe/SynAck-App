import { NavItem } from "./NavItem";

export interface SubNavItem<Id extends string> {
  id: Id;
  label: string;
}

interface SubNavProps<Id extends string> {
  label: string;
  items: readonly SubNavItem<Id>[];
  current: Id;
  onSelect: (id: Id) => void;
}

/** A row of links to the sections of one page. */
export function SubNav<Id extends string>({ label, items, current, onSelect }: SubNavProps<Id>) {
  return (
    <nav className="subnav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <NavItem
              pillId="subnav-pill"
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
  );
}
