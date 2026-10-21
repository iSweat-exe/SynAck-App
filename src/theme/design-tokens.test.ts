/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Reads `tokens.css` as the browser would and checks the contrasts the design promises. */

// Read as a plain file: the test runner replaces CSS imports with nothing, even with `?raw`.
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The `--name: value` declarations of the block that starts with `header`. */
function declarations(header: string): Map<string, string> {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`bloc introuvable : ${header}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const found = new Map<string, string>();
  for (const match of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found.set(name, value.trim());
  }
  return found;
}

const palette = declarations(":root {");
const themes = {
  light: declarations(':root,\n:root[data-theme="light"] {'),
  dark: declarations(':root[data-theme="dark"] {'),
} as const;

/** Follows `var(--other)` references until it reaches a color. */
function colorOf(theme: keyof typeof themes, name: string): string {
  let value = themes[theme].get(name) ?? palette.get(name);
  for (let depth = 0; value?.startsWith("var(") && depth < 10; depth++) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    value = reference ? (themes[theme].get(reference) ?? palette.get(reference)) : undefined;
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`${theme} ${name} : ${value ?? "?"}`);
  return value.toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(theme: keyof typeof themes, foreground: string, background: string): number {
  const [lighter, darker] = [
    luminance(colorOf(theme, foreground)),
    luminance(colorOf(theme, background)),
  ].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** [foreground, background, minimum] */
type Pair = readonly [string, string, number];

const READABLE_TEXT: readonly Pair[] = [
  ["--ink", "--bg", 7],
  ["--ink", "--surface", 7],
  ["--ink", "--inset", 7],
  ["--ink", "--secondary-bg", 7],
  ["--muted", "--bg", 4.5],
  ["--muted", "--surface", 4.5],
  ["--on-primary", "--brand", 4.5],
  ["--success-fg", "--success-bg", 4.5],
  ["--warning-fg", "--warning-bg", 4.5],
  ["--danger-fg", "--danger-bg", 4.5],
  ["--callout-fg", "--callout-bg", 4.5],
];

const VISIBLE_SHAPES: readonly Pair[] = [
  ["--outline", "--bg", 3],
  ["--outline", "--surface", 3],
];

describe.each(["light", "dark"] as const)("the %s theme", (theme) => {
  it.each(READABLE_TEXT)(
    "keeps %s readable on %s (at least %s:1)",
    (foreground, background, minimum) => {
      expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(minimum);
    },
  );

  it.each(VISIBLE_SHAPES)(
    "keeps %s visible on %s (at least %s:1)",
    (foreground, background, minimum) => {
      expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(minimum);
    },
  );
});

describe("the dark theme is easy on the eyes", () => {
  it("keeps the green accent of a solved exercise visible on the page", () => {
    expect(contrast("dark", "--success-accent", "--bg")).toBeGreaterThanOrEqual(3);
  });

  // Not checked in light mode, where the green shadow is 2.8:1: it is only one cue among several
  // (the struck-through title, the "Résolu" badge in text), none of them relies on color alone.

  it("is not black: the page has some light in it", () => {
    expect(luminance(colorOf("dark", "--bg"))).toBeGreaterThan(0.015);
  });

  it("does not glare: text on a card stays under 12:1 (white on black is 16:1)", () => {
    expect(contrast("dark", "--ink", "--surface")).toBeLessThan(12);
  });

  it("does not use pure white for text or outlines", () => {
    expect(colorOf("dark", "--ink")).not.toBe("#ffffff");
    expect(colorOf("dark", "--outline")).not.toBe("#ffffff");
  });

  it("casts a hard shadow darker than the page, so that it shows", () => {
    expect(luminance(colorOf("dark", "--shadow"))).toBeLessThan(luminance(colorOf("dark", "--bg")));
  });

  it("tones the brand pink down compared with light mode", () => {
    expect(luminance(colorOf("dark", "--brand"))).toBeLessThan(
      luminance(colorOf("light", "--brand")),
    );
  });
});
