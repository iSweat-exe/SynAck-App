import { describe, expect, it } from "vitest";
import { levelOf, rewardOf, totalCoins, totalXp } from "./xp";

describe("totalXp", () => {
  it("should be zero when nothing is finished", () => {
    expect(totalXp([])).toBe(0);
  });

  it("should give more for a harder one", () => {
    expect(totalXp(["easy", "medium", "hard"])).toBe(60);
  });
});

describe("levelOf", () => {
  it("should start at level 1 with no experience", () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, size: 100 });
  });

  it("should stay in the level one point before the next", () => {
    expect(levelOf(99).level).toBe(1);
  });

  it("should reach level 2 at exactly 100", () => {
    expect(levelOf(100)).toEqual({ level: 2, into: 0, size: 100 });
  });

  it("should keep the remainder as progress in the level", () => {
    expect(levelOf(235)).toEqual({ level: 3, into: 35, size: 100 });
  });
});

describe("rewardOf", () => {
  it("should give more for a harder one", () => {
    expect(rewardOf("hard").xp).toBeGreaterThan(rewardOf("easy").xp);
  });

  it("should give both experience and coins", () => {
    expect(rewardOf("medium")).toEqual({ xp: 20, coins: 10 });
  });
});

describe("totalCoins", () => {
  it("should be zero when nothing is finished", () => {
    expect(totalCoins([])).toBe(0);
  });

  it("should add the coins of everything finished", () => {
    expect(totalCoins(["easy", "medium", "hard"])).toBe(30);
  });

  it("should match the sum of the rewards", () => {
    const finished = ["easy", "hard"] as const;
    expect(totalCoins(finished)).toBe(rewardOf("easy").coins + rewardOf("hard").coins);
  });
});
