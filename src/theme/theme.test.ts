import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("keeps the saved choice even when the system prefers the other theme", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system until the learner chooses", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("ignores a saved value that is not a theme", () => {
    expect(resolveTheme("purple", false)).toBe("light");
    expect(resolveTheme("", true)).toBe("dark");
  });
});
