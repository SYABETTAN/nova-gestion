import { test, expect } from "@playwright/test";

test.describe("Recherche globale", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.ENABLE_DEV_LOGIN !== "true",
      "ENABLE_DEV_LOGIN requis pour ce test",
    );
    await page.goto("/login");
    await page.getByRole("button", { name: /Connexion développeur/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("page recherche accessible", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: /Recherche/i })).toBeVisible();
  });
});
