import { expect, test } from "@playwright/test";

const seededModernDeck = "a0000000-0000-4000-8000-000000000102";

test("navigates from the format directory to a format and a deck", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/decks");

  await expect(page.getByRole("heading", { name: "Cada formato, su mesa." })).toBeVisible();
  for (const format of ["Commander", "Standard", "Modern", "Pioneer"]) {
    await expect(page.getByRole("heading", { name: format, exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: /Entrar en Modern/ }).click();
  await expect(page).toHaveURL(/\/decks\/modern$/);
  await expect(page.getByRole("heading", { level: 1, name: "Modern" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Arquetipos de Modern" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Todas las listas/ })).toHaveAttribute("href", "/decks/modern/lists");

  const archetype = page.locator(".archetype-card").filter({ hasText: "Delirium tempo" });
  await expect(archetype).toContainText("2 listas");
  await archetype.click();
  await expect(page).toHaveURL(/\/decks\/modern\/archetypes\/grupo-[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Delirium tempo" })).toBeVisible();
  await expect(page.locator(".deck-library-card")).toHaveCount(2);

  await page.locator(".deck-library-card").filter({ hasText: "Delirium tempo" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/deck/${seededModernDeck}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Delirium tempo" })).toBeVisible();

  await page.getByRole("button", { name: "Exportar" }).click();
  await page.getByRole("menuitem", { name: /Magic Arena/ }).click();
  await expect(page.getByRole("dialog", { name: "Magic Arena" })).toBeVisible();
  await expect(page.getByLabel("Lista preparada para Magic Arena")).toHaveValue(/About\nName Delirium tempo\n\nDeck\n/);
  await page.getByRole("button", { name: "Copiar lista" }).click();
  await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Name Delirium tempo\n\nDeck");
});

test("keeps legacy format and deck links working", async ({ page }) => {
  await page.goto("/decks?format=pioneer");
  await expect(page).toHaveURL(/\/decks\/pioneer$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pioneer" })).toBeVisible();

  await page.goto(`/decks/${seededModernDeck}`);
  await expect(page).toHaveURL(new RegExp(`/deck/${seededModernDeck}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Delirium tempo" })).toBeVisible();
});

test("previews Arena metadata and sideboard as separate zones", async ({ page }) => {
  await page.route("**/api/decks/preview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        cards: [
          { quantity: 60, name: "Forest", canonicalName: "Forest", zone: "mainboard", scryfallId: "11111111-1111-4111-8111-111111111111", oracleId: "22222222-2222-4222-8222-222222222222", typeLine: "Basic Land — Forest", imageSmall: null, imageNormal: null },
          { quantity: 15, name: "Torpor Orb", canonicalName: "Torpor Orb", zone: "sideboard", scryfallId: "33333333-3333-4333-8333-333333333333", oracleId: "44444444-4444-4444-8444-444444444444", typeLine: "Artifact", imageSmall: null, imageNormal: null },
        ],
        invalidLines: [],
        suggestedTitle: "Mono-Green Landfall",
        unresolved: [],
        totalCards: 75,
      },
    });
  });

  await page.goto("/decks/new?format=standard");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Formato")).toHaveValue("standard");
  await page.getByLabel("Lista de cartas").fill("About\nName Mono-Green Landfall\n\nDeck\n60 Forest\n\nSideboard\n15 Torpor Orb");
  const previewResponse = page.waitForResponse((response) => response.url().endsWith("/api/decks/preview"));
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await previewResponse;

  await expect(page.getByLabel("Nombre del mazo")).toHaveValue("Mono-Green Landfall");
  await expect(page.locator(".preview-zone").filter({ hasText: "Mazo principal" })).toContainText("60 cartas");
  await expect(page.locator(".preview-zone").filter({ hasText: "Banquillo" })).toContainText("15 cartas");
  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
});
