import { describe, expect, it } from "vitest";
import { initialPlayer, playerReducer, type PlayerState } from "./player";

const LAST = 4;
const at = (current: number, playing = false): PlayerState => ({ current, playing, run: 0 });

describe("playerReducer", () => {
  it("starts on the first step, playing unless reduced motion is asked", () => {
    expect(initialPlayer(true)).toEqual({ current: 0, playing: true, run: 0 });
    expect(initialPlayer(false).playing).toBe(false);
  });

  it("goes to the next step while playing", () => {
    expect(playerReducer(at(1, true), { type: "next", last: LAST })).toMatchObject({
      current: 2,
      playing: true,
    });
  });

  it("stops playing when it reaches the last step", () => {
    expect(playerReducer(at(3, true), { type: "next", last: LAST })).toMatchObject({
      current: 4,
      playing: false,
    });
  });

  it("does not go past the last step", () => {
    expect(playerReducer(at(4), { type: "next", last: LAST }).current).toBe(4);
  });

  it("goes back one step and pauses, because the learner has taken over", () => {
    expect(playerReducer(at(3, true), { type: "previous" })).toMatchObject({
      current: 2,
      playing: false,
    });
  });

  it("does not go before the first step", () => {
    expect(playerReducer(at(0), { type: "previous" }).current).toBe(0);
  });

  it("jumps to a step, pausing, and never outside the steps", () => {
    expect(playerReducer(at(0, true), { type: "goto", index: 3, last: LAST })).toMatchObject({
      current: 3,
      playing: false,
    });
    expect(playerReducer(at(0), { type: "goto", index: 99, last: LAST }).current).toBe(LAST);
    expect(playerReducer(at(2), { type: "goto", index: -5, last: LAST }).current).toBe(0);
  });

  it("restarts from the beginning, playing, and lets the animation play again", () => {
    const restarted = playerReducer(at(4), { type: "restart" });
    expect(restarted).toMatchObject({ current: 0, playing: true });
    expect(restarted.run).toBeGreaterThan(0);
  });

  it("plays and pauses without moving", () => {
    expect(playerReducer(at(2), { type: "play" })).toMatchObject({ current: 2, playing: true });
    expect(playerReducer(at(2, true), { type: "pause" })).toMatchObject({
      current: 2,
      playing: false,
    });
  });
});
