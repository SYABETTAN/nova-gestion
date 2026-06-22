import { test, expect } from "@playwright/test";
import { loginAsCiUser, logout } from "./helpers/auth";

test.describe("Smoke E2E — parcours critiques", () => {
  test("login et logout", async ({ page }) => {
    await loginAsCiUser(page);
    await logout(page);
  });

  test("création client", async ({ page }) => {
    await loginAsCiUser(page);
    const name = `Client CI ${Date.now()}`;
    await page.goto("/customers/new");
    await page.getByLabel(/^Nom/i).fill(name);
    await page.getByLabel(/^Email/i).fill(`ci-${Date.now()}@example.test`);
    await page.getByRole("button", { name: /Enregistrer|Créer/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });
  });

  test("accès module devis", async ({ page }) => {
    await loginAsCiUser(page);
    await page.goto("/quotes");
    await expect(page).toHaveURL(/\/quotes/);
    await page.goto("/quotes/new");
    await expect(page).toHaveURL(/\/quotes\/new/);
  });

  test("API health répond", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks?.database).toBe("ok");
  });
});
