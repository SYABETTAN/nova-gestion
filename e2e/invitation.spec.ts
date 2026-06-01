import { test, expect } from "@playwright/test";

test.describe("Acceptation d'invitation", () => {
  test("refuse un token invalide", async ({ page }) => {
    await page.goto("/accept-invitation/invalid-token-not-a-real-invite");
    await expect(page.getByText(/Invitation indisponible|invalide/i)).toBeVisible();
  });
});
