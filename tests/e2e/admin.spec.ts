import { expect, test } from "@playwright/test";

test("requires a session before entering administration", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/auth\?message=/);
  await expect(page.getByRole("heading", { name: "Entra en Spellbook" })).toBeVisible();
  await expect(page.getByText("Inicia sesión para acceder a la administración.")).toBeVisible();
});
