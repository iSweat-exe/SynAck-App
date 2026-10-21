import type { ShopArtId } from "./catalog";

/*
 * The shop drawings are pixel art in two tones. A sprite is a list of rows of the same width:
 * `#` is ink (the color of the text), `o` is paper (the color of the card) and `.` is empty. Ink
 * and paper are roles, so the drawings turn white on dark in the dark theme.
 */

export type Sprite = readonly string[];

/** A horizontal run of one tone, in pixels: the sprite is drawn with these, not one square each. */
export interface Run {
  x: number;
  y: number;
  width: number;
  tone: "ink" | "paper";
}

/** Merges neighbouring pixels of the same tone in a row into one rectangle. */
export function toRuns(sprite: Sprite): Run[] {
  const runs: Run[] = [];
  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const cell = row[x];
      if (cell !== "#" && cell !== "o") {
        x += 1;
        continue;
      }
      let end = x;
      while (row[end + 1] === cell) end += 1;
      runs.push({ x, y, width: end - x + 1, tone: cell === "#" ? "ink" : "paper" });
      x = end + 1;
    }
  });
  return runs;
}

const BOLT: Sprite = [
  "........#####...",
  ".......#####....",
  "......#####.....",
  ".....#####......",
  "....#####.......",
  "...###########..",
  "....###########.",
  ".........#####..",
  "........#####...",
  ".......#####....",
  "......#####.....",
  ".....#####......",
  "....#####.......",
  "...####.........",
  "..###...........",
  ".##.............",
];

const COIN: Sprite = [
  "..######..",
  ".#oooooo#.",
  "#oo####oo#",
  "#o#oooo#o#",
  "#o#oooo#o#",
  "#o#oooo#o#",
  "#o#oooo#o#",
  "#oo####oo#",
  ".#oooooo#.",
  "..######..",
];

/** Draws `top` over `base` with its corner at (x, y); empty cells of `top` leave `base` alone. */
function stamp(base: readonly string[], top: Sprite, x: number, y: number): string[] {
  const rows = base.map((row) => row.split(""));
  top.forEach((line, dy) => {
    const target = rows[y + dy];
    if (target === undefined) return;
    for (let dx = 0; dx < line.length; dx += 1) {
      const cell = line[dx];
      if (cell !== undefined && cell !== ".") target[x + dx] = cell;
    }
  });
  return rows.map((row) => row.join(""));
}

const BLANK_16: Sprite = Array.from({ length: 16 }, () => ".".repeat(16));

/** Two coins, one in front of the other. */
const COINS: Sprite = stamp(stamp(BLANK_16, COIN, 6, 0), COIN, 0, 6);

const SNOWFLAKE: Sprite = [
  ".......#.......",
  "......###......",
  "..#....#....#..",
  "...#...#...#...",
  "....#..#..#....",
  ".....#.#.#.....",
  "......###......",
  ".#############.",
  "......###......",
  ".....#.#.#.....",
  "....#..#..#....",
  "...#...#...#...",
  "..#....#....#..",
  "......###......",
  ".......#.......",
];

const BULB: Sprite = [
  "....#####....",
  "..##ooooo##..",
  ".#ooooooooo#.",
  "#ooooooooooo#",
  "#ooooo#ooooo#",
  "#ooooooooooo#",
  ".#ooooooooo#.",
  "..#ooooooo#..",
  "...#ooooo#...",
  "...#ooooo#...",
  "...#######...",
  "...#ooooo#...",
  "...#######...",
  "...#ooooo#...",
  "....#####....",
];

const STAR: Sprite = [
  ".......##.......",
  "......####......",
  "......####......",
  "..############..",
  "...##########...",
  "....########....",
  "....########....",
  "...####..####...",
  "..####....####..",
  "..###......###..",
];

/** A small window whose content is a pattern: the three themes differ by their texture. */
function windowSprite(texture: (x: number, y: number) => boolean): Sprite {
  const width = 16;
  const height = 14;
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) return "#";
      if (y === 3) return "#";
      if (y < 3) return y === 1 && [2, 4, 6].includes(x) ? "#" : "o";
      return texture(x, y) ? "#" : "o";
    }).join(""),
  );
}

/** A frame around an avatar: a thick border, a head and shoulders. */
function frameSprite(): Sprite {
  const size = 16;
  const ink = (x: number, y: number): boolean => {
    if (x < 2 || x >= size - 2 || y < 2 || y >= size - 2) return true;
    const head = y >= 4 && y <= 7 && x >= 6 && x <= 9;
    const roundedOff = (x === 6 || x === 9) && (y === 4 || y === 7);
    if (head && !roundedOff) return true;
    const shoulders = (y === 9 && x >= 5 && x <= 10) || (y >= 10 && y <= 12 && x >= 4 && x <= 11);
    return shoulders;
  };
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => (ink(x, y) ? "#" : "o")).join(""),
  );
}

/** Centers a sprite on a square canvas, so that every drawing has pixels of the same size. */
function center(sprite: Sprite, size = 16): Sprite {
  const width = sprite[0]?.length ?? 0;
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - sprite.length) / 2);
  return Array.from({ length: size }, (_, y) => {
    const row = sprite[y - top];
    if (row === undefined) return ".".repeat(size);
    return ".".repeat(left) + row + ".".repeat(size - width - left);
  });
}

export const SPRITES: Record<ShopArtId, Sprite> = {
  "double-xp": BOLT,
  "double-coins": COINS,
  freeze: center(SNOWFLAKE),
  hint: center(BULB),
  // Mint: a checkerboard. Ocean: lines of waves. Sun: a field of dots.
  "theme-mint": center(windowSprite((x, y) => (x + y) % 2 === 0)),
  "theme-ocean": center(windowSprite((x, y) => y % 3 === 0 && (x + y) % 6 !== 0)),
  "theme-sun": center(windowSprite((x, y) => x % 3 === 1 && y % 3 === 1)),
  frame: frameSprite(),
  title: center(STAR),
};
