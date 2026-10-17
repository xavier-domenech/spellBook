import { expect, test } from "@playwright/test";

test("an administrator manages a versioned decklist lifecycle", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const initialTitle = `Decklist E2E ${suffix}`;
  const revisedTitle = `Decklist revisada ${suffix}`;
  const previewPayload = {
    cards: [{
      quantity: 60,
      name: "Forest",
      canonicalName: "Forest",
      zone: "mainboard",
      scryfallId: "22222222-2222-4222-8222-222222222222",
      oracleId: "11111111-1111-4111-8111-111111111111",
      typeLine: "Basic Land — Forest",
      imageSmall: null,
      imageNormal: null,
    }],
    totalCards: 60,
    invalidLines: [],
    suggestedTitle: null,
    unresolved: [],
  };

  await page.route("**/api/decks/preview", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(previewPayload) });
  });
  await page.goto("/auth");
  await page.getByLabel("Email").fill("xavidp@demo.magicsocial.local");
  await page.getByLabel("Contraseña").fill("MagicSocial123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/admin/decklists");
  await expect(page.getByRole("heading", { name: "Decklists", exact: true })).toBeVisible();
  await page.locator(".admin-deck-create summary").click();
  const createForm = page.locator(".admin-deck-create .admin-deck-editor");
  await createForm.getByLabel("Título").fill(initialTitle);
  await createForm.getByLabel("Propietario").selectOption({ label: "Ariadna Serra · @ariadna_control" });
  await createForm.getByLabel("Formato").selectOption("standard");
  await createForm.getByLabel("Visibilidad").selectOption("private");
  await createForm.getByLabel("Lista de cartas").fill("Deck\n60 Forest");
  await createForm.getByRole("button", { name: "Previsualizar" }).click();
  await expect(createForm.getByText("60 cartas · lista válida")).toBeVisible();
  await createForm.getByRole("button", { name: "Crear decklist" }).click();
  await expect(page.getByText(`Decklist ${initialTitle} creada.`)).toBeVisible();

  let card = page.locator(".admin-deck-card").filter({ has: page.getByRole("heading", { name: initialTitle, exact: true }) });
  await card.getByLabel("Título").fill(revisedTitle);
  await card.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: revisedTitle, exact: true })).toBeVisible();
  await expect(page.getByText(`${revisedTitle} actualizada.`)).toBeVisible();

  card = page.locator(".admin-deck-card").filter({ has: page.getByRole("heading", { name: revisedTitle, exact: true }) });
  await card.locator(".admin-deck-version summary").click();
  const versionForm = card.locator(".admin-deck-version .admin-deck-editor");
  await versionForm.getByLabel("Lista de cartas").fill("Deck\n60 Forest");
  await versionForm.getByLabel("Nota de versión").fill("Segunda versión E2E");
  await versionForm.getByRole("button", { name: "Previsualizar" }).click();
  await versionForm.getByRole("button", { name: "Publicar versión" }).click();
  await expect(page.getByText("Versión 2 actualizada.")).toBeVisible();

  card = page.locator(".admin-deck-card").filter({ has: page.getByRole("heading", { name: revisedTitle, exact: true }) });
  await expect(card.getByText("v2", { exact: false })).toBeVisible();
  await card.getByLabel(`Motivo para ocultar ${revisedTitle}`).fill("Moderación temporal E2E");
  await card.getByRole("button", { name: "Ocultar" }).click();
  card = page.locator(".admin-deck-card").filter({ has: page.getByRole("heading", { name: revisedTitle, exact: true }) });
  await expect(card.getByText("Oculta", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Mostrar" }).click();
  card = page.locator(".admin-deck-card").filter({ has: page.getByRole("heading", { name: revisedTitle, exact: true }) });
  await expect(card.getByText("Visible", { exact: true })).toBeVisible();

  await card.getByLabel(`Motivo para archivar ${revisedTitle}`).fill("Eliminar fixture E2E");
  await card.getByRole("button", { name: "Archivar" }).click();
  card = page.locator(".admin-deck-card").filter({ has: page.getByRole("heading", { name: revisedTitle, exact: true }) });
  await expect(card.getByText("Archivada", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(/Decklist .* eliminada\./)).toBeVisible();
  await expect(page.getByRole("heading", { name: revisedTitle, exact: true })).toHaveCount(0);
});
