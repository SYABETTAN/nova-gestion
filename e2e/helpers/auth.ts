import { expect, type Page } from "@playwright/test";
import { CI_E2E_OWNER_EMAIL, CI_E2E_OWNER_PASSWORD } from "@/lib/ci-test-credentials";

export async function loginAsCiUser(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Email/i).fill(CI_E2E_OWNER_EMAIL);
  await page.getByLabel(/Mot de passe/i).fill(CI_E2E_OWNER_PASSWORD);
  await page.getByRole("button", { name: /^Connexion$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  await expect(page.locator("header")).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /Déconnexion/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
