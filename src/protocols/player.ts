/** The state of the animation player: which step is shown, and whether it plays by itself. */
export interface PlayerState {
  /** Index of the step being shown. */
  current: number;
  playing: boolean;
  /** Counts the times the learner restarted or jumped: lets the animation play again. */
  run: number;
}

export type PlayerAction =
  | { type: "next"; last: number }
  | { type: "previous" }
  | { type: "goto"; index: number; last: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "restart" };

/** Starts at the first step, playing by itself unless the learner prefers reduced motion. */
export function initialPlayer(autoplay: boolean): PlayerState {
  return { current: 0, playing: autoplay, run: 0 };
}

const clamp = (value: number, last: number) => Math.max(0, Math.min(value, last));

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "next": {
      const current = clamp(state.current + 1, action.last);
      // Reaching the end stops the playback.
      return { ...state, current, playing: state.playing && current < action.last };
    }
    case "previous":
      // The learner takes over: going back pauses.
      return {
        ...state,
        current: clamp(state.current - 1, state.current),
        playing: false,
        run: state.run + 1,
      };
    case "goto":
      return {
        ...state,
        current: clamp(action.index, action.last),
        playing: false,
        run: state.run + 1,
      };
    case "play":
      return { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "restart":
      return { current: 0, playing: true, run: state.run + 1 };
  }
}
