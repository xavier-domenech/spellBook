import { expect, test } from "@playwright/test";

test("an administrator updates and moderates a user", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const email = `admin-user-${suffix}@example.invalid`;
  const handle = `user_${suffix}`;
  await page.goto("/auth");
  await page.getByLabel("Email").fill("xavidp@demo.magicsocial.local");
  await page.getByLabel("Contraseña").fill("MagicSocial123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
  await page.locator(".admin-format-create summary").click();
  await page.getByLabel("Nombre visible", { exact: true }).fill(`Usuario E2E ${suffix}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.getByText(`Invitación enviada a ${email}.`)).toBeVisible();

  const card = page.locator(".admin-user-card").filter({ hasText: email });
  await expect(card).toBeVisible();

  await card.getByLabel("Nombre").fill("Nil revisado E2E");
  await card.getByLabel("Handle").fill(handle);
  await card.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText(`Cambio guardado: ${handle}.`)).toBeVisible();

  const revisedCard = page.locator(".admin-user-card").filter({ hasText: handle });
  await revisedCard.getByLabel("Motivo para suspender a Nil revisado E2E").fill("Prueba temporal E2E");
  await revisedCard.getByRole("button", { name: "Suspender" }).click();
  await expect(page.getByText("Suspendido", { exact: true })).toBeVisible();

  await page.locator(".admin-user-card").filter({ hasText: handle }).getByRole("button", { name: "Reactivar" }).click();
  await expect(page.locator(".admin-user-card").filter({ hasText: handle }).getByText("Pendiente", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".admin-user-card").filter({ hasText: handle }).getByRole("button", { name: "Eliminar vacía" }).click();
  await expect(page.getByText("Cuenta eliminada.")).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
});
