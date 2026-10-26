import { expect, test } from "@playwright/test";
import { installFakeTauri } from "./fakeTauri";

test.describe("the profile", () => {
  test("changing the answers changes the recommendations", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");

    const recommended = page.getByRole("region", { name: "Recommandations" });
    // A beginner is offered easy exercises first.
    await expect(recommended.getByRole("button").first()).toContainText("Facile");

    await page.getByRole("button", { name: /Élève de test/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Profil" })).toBeVisible();
    await page.getByRole("radio", { name: /^Avancé/ }).check();
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

    await page
      .getByRole("button", { name: /^Exercices/ })
      .first()
      .click();
    await expect(recommended.getByRole("button").first()).toContainText("Difficile");
  });

  test("the saved answers are the ones shown the next time", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");
    await page.getByRole("button", { name: /Élève de test/ }).click();
    await page.getByRole("radio", { name: /^Intermédiaire/ }).check();
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /Élève de test/ }).click();

    await expect(page.getByRole("radio", { name: /^Intermédiaire/ })).toBeChecked();
  });

  test("someone who skipped the questions can answer them from the profile", async ({ page }) => {
    await installFakeTauri(page, { onboarding: null });
    await page.goto("/");
    await page.getByRole("button", { name: "Passer pour l'instant" }).click();

    await page.getByRole("button", { name: "Répondre aux questions" }).click();
    await expect(page.getByRole("button", { name: "Enregistrer mes préférences" })).toBeDisabled();

    await page.getByRole("radio", { name: /^Débutant/ }).check();
    await page.getByRole("checkbox", { name: /^Web/ }).check();
    await page.getByRole("radio", { name: /^Par curiosité/ }).check();
    await page.getByRole("radio", { name: /^1 à 3 heures/ }).check();
    await page.getByRole("checkbox", { name: /^Pratiquer tout de suite/ }).check();

    await expect(page.getByRole("button", { name: "Enregistrer mes préférences" })).toBeEnabled();
  });
});

test.describe("the theme", () => {
  test("switches to the dark theme and back", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Passer au thème sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "Passer au thème clair" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
