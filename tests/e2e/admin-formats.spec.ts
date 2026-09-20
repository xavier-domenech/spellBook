import { expect, test } from "@playwright/test";

test("an administrator manages the complete format lifecycle", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const slug = `pauper-e2e-${suffix}`;
  const initialName = `Pauper E2E ${suffix}`;
  const updatedName = `Pauper revisado ${suffix}`;

  await page.goto("/auth");
  await page.getByLabel("Email").fill("xavidp@demo.magicsocial.local");
  await page.getByLabel("Contraseña").fill("MagicSocial123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/admin/formats");
  await expect(page.getByRole("heading", { name: "Formatos", exact: true })).toBeVisible();
  await page.locator(".admin-format-create summary").click();
  const createForm = page.locator(".admin-format-create form");
  await createForm.getByLabel("Nombre").fill(initialName);
  await createForm.getByLabel("Slug").fill(slug);
  await createForm.getByLabel("Descripción").fill("Formato temporal creado por la prueba de navegador.");
  await createForm.getByLabel("Resumen de reglas").fill("Mínimo 60 cartas principales");
  await createForm.getByRole("button", { name: "Crear formato" }).click();
  await expect(page.getByText(`Formato ${slug} creado.`)).toBeVisible();

  let card = page.locator(".admin-format-card").filter({ has: page.getByRole("heading", { name: initialName, exact: true }) });
  await expect(card).toBeVisible();

  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: initialName, exact: true })).toBeVisible();

  await page.goto("/admin/formats");
  card = page.locator(".admin-format-card").filter({ has: page.getByRole("heading", { name: initialName, exact: true }) });
  await card.getByLabel("Nombre").fill(updatedName);
  await card.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(`Formato ${slug} actualizado.`)).toBeVisible();

  card = page.locator(".admin-format-card").filter({ has: page.getByRole("heading", { name: updatedName, exact: true }) });
  await card.getByRole("button", { name: "Archivar" }).click();
  await expect(card.getByText("Archivado", { exact: true })).toBeVisible();

  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: updatedName, exact: true })).toHaveCount(0);
  await page.goto(`/decks/${slug}`);
  await expect(page.getByRole("heading", { name: updatedName, exact: true })).toBeVisible();
  await expect(page.getByText("Formato archivado", { exact: true })).toBeVisible();

  await page.goto("/admin/formats");
  card = page.locator(".admin-format-card").filter({ has: page.getByRole("heading", { name: updatedName, exact: true }) });
  await card.getByRole("button", { name: "Reactivar" }).click();
  await expect(card.getByText("Activo", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(`Formato ${slug} eliminado.`)).toBeVisible();
  await expect(page.getByRole("heading", { name: updatedName, exact: true })).toHaveCount(0);
});
