import type { ReactNode } from "react";

/** The top bar, above the page: the breadcrumb says where the learner is. */
export function Navbar({ children }: { children?: ReactNode }) {
  return <header className="navbar">{children}</header>;
}
