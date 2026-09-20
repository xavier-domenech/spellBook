import { expect, test } from "@playwright/test";

test("an administrator manages an organization lifecycle", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const slug = `admin-org-${suffix}`;
  const initialName = `Organización E2E ${suffix}`;
  const revisedName = `Organización revisada ${suffix}`;

  await page.goto("/auth");
  await page.getByLabel("Email").fill("xavidp@demo.magicsocial.local");
  await page.getByLabel("Contraseña").fill("MagicSocial123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/admin/organizations");
  await expect(page.getByRole("heading", { name: "Organizaciones", exact: true })).toBeVisible();
  await page.locator(".admin-format-create summary").click();
  const createForm = page.locator(".admin-organization-create-form");
  await createForm.getByLabel("Nombre").fill(initialName);
  await createForm.getByLabel("Slug").fill(slug);
  await createForm.getByLabel("Propietario").selectOption({ label: "xavidp · @xavidp" });
  await createForm.getByLabel("Descripción").fill("Organización temporal para el recorrido E2E.");
  await createForm.getByLabel("Commander").check();
  await createForm.getByRole("button", { name: "Crear organización" }).click();
  await expect(page.getByText(`Organización ${slug} creada.`)).toBeVisible();

  let card = page.locator(".admin-organization-card").filter({ hasText: slug });
  await expect(card).toBeVisible();
  await card.getByLabel("Nombre").fill(revisedName);
  await card.getByLabel("Acceso").selectOption("private");
  await card.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(`Organización ${slug} actualizada.`)).toBeVisible();

  card = page.locator(".admin-organization-card").filter({ hasText: slug });
  await card.getByLabel(`Motivo para archivar ${revisedName}`).fill("Fin de la prueba temporal");
  await card.getByRole("button", { name: "Archivar" }).click();
  card = page.locator(".admin-organization-card").filter({ hasText: slug });
  await expect(card.getByText("Archivada", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Restaurar" }).click();
  card = page.locator(".admin-organization-card").filter({ hasText: slug });
  await expect(card.getByText("Activa", { exact: true })).toBeVisible();
  await card.getByLabel(`Motivo para archivar ${revisedName}`).fill("Eliminar fixture E2E");
  await card.getByRole("button", { name: "Archivar" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".admin-organization-card").filter({ hasText: slug }).getByRole("button", { name: "Eliminar vacía" }).click();
  await expect(page.getByText(`Organización ${slug} eliminada.`)).toBeVisible();
  await expect(page.locator(".admin-organization-card").filter({ hasText: slug })).toHaveCount(0);
});
