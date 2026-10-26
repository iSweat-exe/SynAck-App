import { expect, test } from "@playwright/test";
import { installFakeTauri } from "./fakeTauri";

test.describe("sign-in and first questions", () => {
  test("a visitor signs in, answers the six questions and lands on the exercises", async ({
    page,
  }) => {
    await installFakeTauri(page, { signedIn: false, onboarding: null });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Connexion/ })).toBeVisible();
    const github = page.getByRole("button", { name: "Continuer avec GitHub" });
    await expect(github).toBeDisabled();
    await page.getByLabel("J'ai au moins 15 ans.").check();
    await github.click();

    await expect(page.getByText("Question 1 sur 6")).toBeVisible();
    await page.getByRole("radio", { name: /^Débutant/ }).check();
    await page.getByRole("button", { name: "Continuer" }).click();

    await page.getByRole("checkbox", { name: /^Web/ }).check();
    await page.getByRole("button", { name: "Continuer" }).click();

    // The languages already known are optional.
    await page.getByRole("button", { name: "Continuer" }).click();

    await page.getByRole("radio", { name: /^Par curiosité/ }).check();
    await page.getByRole("button", { name: "Continuer" }).click();

    await page.getByRole("radio", { name: /^1 à 3 heures/ }).check();
    await page.getByRole("button", { name: "Continuer" }).click();

    await expect(page.getByText("Question 6 sur 6")).toBeVisible();
    await page.getByRole("checkbox", { name: /^Pratiquer tout de suite/ }).check();
    await page.getByRole("button", { name: "Terminer" }).click();

    await expect(page.getByRole("heading", { name: "Exercices", level: 2 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recommandations" })).toBeVisible();
  });

  test("a question that is required cannot be skipped", async ({ page }) => {
    await installFakeTauri(page, { signedIn: true, onboarding: null });
    await page.goto("/");

    await expect(page.getByText("Question 1 sur 6")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  });

  test("the questions can be left for the session", async ({ page }) => {
    await installFakeTauri(page, { signedIn: true, onboarding: null });
    await page.goto("/");

    await page.getByRole("button", { name: "Passer pour l'instant" }).click();

    await expect(page.getByRole("heading", { name: "Exercices", level: 2 })).toBeVisible();
    // Without answers, the recommendations ask for them.
    await expect(page.getByRole("button", { name: "Répondre aux questions" })).toBeVisible();
  });

  test("an account that already answered goes straight to the exercises", async ({ page }) => {
    await installFakeTauri(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Exercices", level: 2 })).toBeVisible();
    await expect(page.getByText("Question 1 sur 6")).toHaveCount(0);
  });
});
