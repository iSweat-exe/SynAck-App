import { expect, test } from "@playwright/test";
import { installFakeTauri } from "./fakeTauri";

test.describe("the search (Ctrl K)", () => {
  test.beforeEach(async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Exercices", level: 2 })).toBeVisible();
  });

  test("opens with Ctrl K, finds an exercise and opens it with Enter", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+K");
    const box = page.getByRole("combobox", { name: "Rechercher" });
    await expect(box).toBeFocused();

    await box.fill("fibo");
    await expect(page.getByRole("option", { name: /Suite de Fibonacci/ })).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 2, name: /Suite de Fibonacci/ })).toBeVisible();
    await expect(box).toBeHidden();
  });

  test("opens from the button of the navbar", async ({ page }) => {
    await page.getByRole("button", { name: /Rechercher/ }).click();

    await expect(page.getByRole("combobox", { name: "Rechercher" })).toBeFocused();
  });

  test("closes with Escape, and Ctrl K again", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+K");
    const box = page.getByRole("combobox", { name: "Rechercher" });
    await expect(box).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(box).toBeHidden();

    await page.keyboard.press("ControlOrMeta+K");
    await expect(box).toBeVisible();
    await page.keyboard.press("ControlOrMeta+K");
    await expect(box).toBeHidden();
  });

  test("finds a protocol and opens it", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+K");
    await page.getByRole("combobox", { name: "Rechercher" }).fill("tcp");

    await page.getByRole("option", { name: /TCP/ }).first().click();

    await expect(page.getByRole("heading", { level: 3, name: /TCP/ })).toBeVisible();
  });

  test("says when nothing matches", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+K");
    await page.getByRole("combobox", { name: "Rechercher" }).fill("zzzzzz");

    await expect(page.getByText(/Rien ne correspond/)).toBeVisible();
  });

  test("moves through the results with the arrows", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+K");
    await page.getByRole("combobox", { name: "Rechercher" }).fill("boucles");

    const options = page.getByRole("option");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(options.first()).toHaveAttribute("aria-selected", "false");
  });

  test("starts empty every time it opens", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+K");
    await page.getByRole("combobox", { name: "Rechercher" }).fill("fizz");
    await page.keyboard.press("Escape");

    await page.keyboard.press("ControlOrMeta+K");

    await expect(page.getByRole("combobox", { name: "Rechercher" })).toHaveValue("");
  });
});
