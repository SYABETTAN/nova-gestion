import { test, expect } from "@playwright/test";

test.describe("Protection des routes", () => {
  test("redirige /dashboard vers login sans session", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("laisse /login accessible sans session", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("laisse /register accessible sans session", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register/);
  });
});
