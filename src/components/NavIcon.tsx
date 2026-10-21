import type { Variants } from "motion/react";
import { AnimatedSvg } from "./AnimatedSvg";

export type NavIconName =
  | "download"
  | "refresh"
  | "close"
  | "reset"
  | "coin"
  | "paths"
  | "courses"
  | "admin"
  | "gift"
  | "exercises"
  | "protocols"
  | "settings"
  | "search"
  | "flame"
  | "bell"
  | "moon"
  | "sun";

const PATHS: Record<NavIconName, string[]> = {
  // An arrow into a tray.
  download: ["M12 4v11", "M7 11l5 5 5-5", "M5 20h14"],
  // Two arrows chasing each other.
  refresh: [
    "M20 11a8 8 0 0 0-14.5-4.4L4 8",
    "M4 4v4h4",
    "M4 13a8 8 0 0 0 14.5 4.4L20 16",
    "M20 20v-4h-4",
  ],
  // A cross.
  close: ["M6 6l12 12", "M18 6L6 18"],
  // An arrow turning back on itself.
  reset: ["M4 4v6h6", "M5.5 14a7 7 0 1 0 1.6-7.3L4 10"],
  // A coin with an S.
  coin: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    "M14.5 9.5C14 8.5 13 8 12 8c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5",
    "M12 6.5V8",
    "M12 16v1.5",
  ],
  // A winding road between a start and an arrival.
  paths: [
    "M5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M19 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6",
  ],
  // A shield with a check.
  admin: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  // A wrapped gift: the bonuses.
  gift: [
    "M4 11h16v9H4z",
    "M3 7h18v4H3z",
    "M12 7v13",
    "M12 7C9.5 7 8 5.8 8 4.5S9.5 3 12 7z",
    "M12 7c2.5 0 4-1.2 4-2.5S14.5 3 12 7z",
  ],
  // An open book.
  courses: ["M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2z", "M4 20a2 2 0 0 0 2 2h14v-4", "M9 8h6"],
  // Angle brackets around a slash: code.
  exercises: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5", "M14 4l-4 16"],
  // Two arrows going opposite ways: a message sent, a message back.
  protocols: ["M4 8h15", "M15 4l4 4-4 4", "M20 16H5", "M9 12l-4 4 4 4"],
  // Two sliders.
  settings: ["M4 8h9", "M17 8h3", "M4 16h3", "M11 16h9", "M15 5v6", "M9 13v6"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4-4"],
  flame: ["M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"],
  bell: ["M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z", "M10 21h4"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  sun: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    "M12 2v2",
    "M12 20v2",
    "M2 12h2",
    "M20 12h2",
    "M5 5l1.5 1.5",
    "M17.5 17.5L19 19",
    "M19 5l-1.5 1.5",
    "M6.5 17.5L5 19",
  ],
};

/** Back to the resting pose at once, so that a keyframe animation can play again from the start. */
const REST = { x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, transition: { duration: 0.12 } };

const quick = { duration: 0.5, ease: "easeInOut" } as const;

/** What each icon does when its button is hovered: a small gesture that says what it is. */
const STATES: Record<NavIconName, Variants> = {
  // The arrow drops into the tray.
  download: {
    rest: REST,
    hover: { y: [0, 3, 0], transition: { duration: 0.5, ease: "easeInOut" } },
  },
  // The arrows turn.
  refresh: {
    rest: REST,
    hover: { rotate: [0, 360], transition: { duration: 0.7, ease: "easeInOut" } },
  },
  // The cross turns a quarter.
  close: { rest: REST, hover: { rotate: [0, 90], transition: { duration: 0.3, ease: "easeOut" } } },
  // The arrow turns back.
  reset: {
    rest: REST,
    hover: { rotate: [0, -360], transition: { duration: 0.6, ease: "easeOut" } },
  },
  // The coin spins on its edge.
  coin: { rest: REST, hover: { scaleX: [1, 0.05, 1], transition: { duration: 0.5 } } },
  // Travels along its road.
  paths: { rest: REST, hover: { x: [0, 3, 0], y: [0, -2, 0], transition: quick } },
  // A page turns.
  courses: { rest: REST, hover: { scaleX: [1, 0.7, 1], transition: quick } },
  // The shield settles.
  admin: { rest: REST, hover: { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0], transition: quick } },
  // The gift hops.
  gift: { rest: REST, hover: { y: [0, -4, 0], rotate: [0, -8, 8, 0], transition: quick } },
  // The brackets rock, like code being typed.
  exercises: { rest: REST, hover: { rotate: [0, -8, 8, 0], transition: quick } },
  // The message goes and comes back.
  protocols: { rest: REST, hover: { x: [0, 3, -3, 0], transition: quick } },
  // The sliders slide.
  settings: { rest: REST, hover: { y: [0, -2, 2, 0], rotate: [0, 8, 0], transition: quick } },
  // The lens looks around.
  search: { rest: REST, hover: { rotate: [0, -14, 14, 0], scale: [1, 1.1, 1], transition: quick } },
  // The flame flickers.
  flame: {
    rest: REST,
    hover: { scale: [1, 1.18, 0.94, 1.1, 1], y: [0, -1.5, 0], transition: { duration: 0.6 } },
  },
  // The bell rings, swinging from its top.
  bell: {
    rest: REST,
    hover: { rotate: [0, 16, -14, 9, -6, 0], transition: { duration: 0.7 } },
  },
  // The moon rocks.
  moon: { rest: REST, hover: { rotate: [0, -22, 0], transition: quick } },
  // The sun turns.
  sun: { rest: REST, hover: { rotate: [0, 180], transition: { duration: 0.6, ease: "easeOut" } } },
};

/** An icon of the interface, animated by the button around it. Same stroke as the check. */
export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <AnimatedSvg
      className="icon"
      states={STATES[name]}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // The bell swings from its top, the others turn on their center.
      style={name === "bell" ? { originX: 0.5, originY: 0.15 } : {}}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </AnimatedSvg>
  );
}
