import { test, expect } from "@playwright/test";

test.describe("Authentification", () => {
  test("redirige vers login si non authentifié", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("connexion avec compte développeur", async ({ page }) => {
    test.skip(
      process.env.ENABLE_DEV_LOGIN !== "true",
      "ENABLE_DEV_LOGIN requis pour ce test",
    );

    await page.goto("/login");
    await page.getByRole("button", { name: /Connexion développeur/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Tableau de bord/i })).toBeVisible();
  });
});
