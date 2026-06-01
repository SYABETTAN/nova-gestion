import { test, expect } from "@playwright/test";

test.describe("Clients", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.ENABLE_DEV_LOGIN !== "true",
      "ENABLE_DEV_LOGIN requis pour ce test",
    );
    await page.goto("/login");
    await page.getByRole("button", { name: /Connexion développeur/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("liste des clients accessible", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: /Clients/i })).toBeVisible();
  });

  test("création d'un client", async ({ page }) => {
    const name = `E2E Client ${Date.now()}`;
    await page.goto("/customers/new");
    await page.getByLabel(/Raison sociale|Nom/i).fill(name);
    await page.getByLabel(/Email/i).fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Enregistrer|Créer/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  });
});
