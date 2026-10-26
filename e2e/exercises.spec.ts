import { expect, test, type Page } from "@playwright/test";
import { installFakeTauri } from "./fakeTauri";

/** Opens an exercise from the list. */
async function open(page: Page, title: RegExp) {
  await page.getByRole("button", { name: title }).first().click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

/**
 * Replaces the code of the editor. Monaco is loaded on demand, so it is waited for, and the text is
 * inserted in one go (typing key by key can lose keystrokes while the editor is still waking up).
 */
async function typeCode(page: Page, code: string) {
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.click();
  await expect(page.getByRole("textbox", { name: /^Solution en / })).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  // The size starts with the number of bytes, then a (no-break) space.
  await expect(page.locator(".code-size")).toContainText(
    new RegExp(String.raw`^${String(code.length)}(?!\d)`),
  );
}

test.describe("the list of exercises", () => {
  test("shows every exercise, with recommendations on top", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");

    await expect(page.getByText("20 exercices")).toBeVisible();
    const recommended = page.getByRole("region", { name: "Recommandations" });
    await expect(recommended.getByRole("button")).toHaveCount(3);
  });

  test("narrows the list with the search field of the filters", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");

    await page.getByPlaceholder("Titre, thème…").fill("fizz");

    await expect(page.getByText("1 exercice", { exact: true })).toBeVisible();
    // Filtering hides the recommendations: the list is what was asked for.
    await expect(page.getByRole("region", { name: "Recommandations" })).toHaveCount(0);
  });

  test("lists the hard exercises", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Difficile", exact: true }).click();

    await expect(page.getByText("5 exercices")).toBeVisible();
  });
});

test.describe("an exercise", () => {
  test("gives its three hints one at a time", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await open(page, /Suite de Fibonacci/);

    await expect(page.getByText(/Indice \d sur 3/)).toHaveCount(0);
    await page.getByRole("button", { name: "Voir un indice" }).click();
    await expect(page.getByText("Indice 1 sur 3")).toBeVisible();
    await expect(page.getByText("Indice 2 sur 3")).toHaveCount(0);

    await page.getByRole("button", { name: "Voir l'indice 2" }).click();
    await expect(page.getByText("Indice 2 sur 3")).toBeVisible();

    await page.getByRole("button", { name: "Voir l'indice 3" }).click();
    await expect(page.getByText("Indice 3 sur 3")).toBeVisible();
    await expect(page.getByText("Tous les indices sont affichés.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Voir (un|l'indice)/ })).toHaveCount(0);
  });

  test("keeps the hints already shown when the learner comes back", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await open(page, /Suite de Fibonacci/);
    await page.getByRole("button", { name: "Voir un indice" }).click();

    await page.getByRole("button", { name: "← Tous les exercices" }).click();
    await open(page, /Suite de Fibonacci/);

    await expect(page.getByText("Indice 1 sur 3")).toBeVisible();
  });

  test("marks an exercise as in progress once code is written, and keeps it after a reload", async ({
    page,
  }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await open(page, /FizzBuzz/);

    await typeCode(page, "x = 1");
    // The code is kept a moment after the last keystroke.
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("fake-backend")))
      .toContain("x = 1");

    await page.getByRole("button", { name: "← Tous les exercices" }).click();
    await expect(
      page.getByRole("button", { name: /FizzBuzz/ }).filter({ hasText: "En cours" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "En cours", exact: true }).click();
    await expect(page.getByText("1 exercice", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "En cours", exact: true }).click();
    await expect(page.getByText("1 exercice", { exact: true })).toBeVisible();
  });

  test("shows the solution and its explanation only once the exercise is solved", async ({
    page,
  }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await open(page, /Suite de Fibonacci/);

    await expect(page.getByRole("button", { name: /Voir le corrigé/ })).toHaveCount(0);

    await typeCode(page, "SOLVED");
    await page.getByRole("button", { name: "Valider" }).click();

    await expect(page.getByText("Exercice déjà résolu.")).toBeVisible();
    await page.getByRole("button", { name: /Voir le corrigé/ }).click();
    await expect(page.getByText("# corrigé de fibonacci")).toBeVisible();
    await expect(page.getByText("Explication de fibonacci.")).toBeVisible();
  });

  test("does not mark an exercise as solved when the code is wrong", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await open(page, /Suite de Fibonacci/);

    await typeCode(page, "x = 1");
    await page.getByRole("button", { name: "Valider" }).click();

    await expect(page.getByText("Exercice déjà résolu.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Voir le corrigé/ })).toHaveCount(0);
  });

  test("shows the streak once something is solved", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await expect(page.getByText("0 jour")).toBeVisible();
    await open(page, /Suite de Fibonacci/);

    await typeCode(page, "SOLVED");
    await page.getByRole("button", { name: "Valider" }).click();

    await expect(page.getByText("1 jour", { exact: true })).toBeVisible();
  });
});
