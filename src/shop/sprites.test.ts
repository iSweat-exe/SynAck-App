import { describe, expect, it } from "vitest";
import { ITEMS } from "./catalog";
import { SPRITES, toRuns } from "./sprites";

describe("the shop sprites", () => {
  it("should draw every item of the catalog", () => {
    for (const item of ITEMS) expect(SPRITES[item.art].length).toBeGreaterThan(0);
  });

  it("should keep every row of a sprite the same width", () => {
    for (const [name, rows] of Object.entries(SPRITES)) {
      const widths = new Set(rows.map((row) => row.length));
      expect(widths.size, name).toBe(1);
    }
  });

  it("should draw every sprite on the same 16 by 16 canvas, so that pixels have one size", () => {
    for (const [name, rows] of Object.entries(SPRITES)) {
      expect([rows.length, rows[0]?.length], name).toEqual([16, 16]);
    }
  });

  it("should use only ink, paper and empty cells", () => {
    for (const [name, rows] of Object.entries(SPRITES)) {
      expect(
        rows.every((row) => /^[#o.]+$/.test(row)),
        name,
      ).toBe(true);
    }
  });

  it("should draw some ink in every sprite", () => {
    for (const [name, rows] of Object.entries(SPRITES)) {
      expect(
        rows.some((row) => row.includes("#")),
        name,
      ).toBe(true);
    }
  });
});

describe("toRuns", () => {
  it("should merge neighbouring pixels of the same tone", () => {
    expect(toRuns(["###"])).toEqual([{ x: 0, y: 0, width: 3, tone: "ink" }]);
  });

  it("should split where the tone changes", () => {
    expect(toRuns(["#o"]).map((run) => run.tone)).toEqual(["ink", "paper"]);
  });

  it("should leave empty cells out", () => {
    expect(toRuns(["#.#"]).map((run) => run.x)).toEqual([0, 2]);
  });

  it("should cover every drawn pixel exactly once", () => {
    const rows = ["##o.", "o###"];
    const drawn = rows.join("").replace(/\./g, "").length;
    expect(toRuns(rows).reduce((sum, run) => sum + run.width, 0)).toBe(drawn);
  });
});
