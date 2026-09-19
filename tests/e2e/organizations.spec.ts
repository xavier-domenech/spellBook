import { expect, test } from "@playwright/test";

test("browses a public organization and keeps private forums protected", async ({ page }) => {
  await page.goto("/organizations");
  await expect(page.getByRole("heading", { level: 1, name: "Organizaciones" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Lliga Spellbook/ })).toBeVisible();

  await page.getByRole("link", { name: /Lliga Spellbook/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lliga Spellbook" })).toBeVisible();
  await page.goto("/organizations/lliga-spellbook/forum");
  await expect(page.getByRole("heading", { name: "Foro general" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Presentaciones y primeras partidas/ })).toBeVisible();

  const privateForum = await page.request.get("/organizations/equip-arcane/forum", { maxRedirects: 0 });
  expect(privateForum.status()).toBe(307);
  expect(privateForum.headers().location).toContain("/organizations/equip-arcane?error=");
  await page.goto("/organizations/equip-arcane?error=Necesitas%20ser%20miembro%20para%20acceder%20al%20foro.");
  await expect(page.getByText("Necesitas ser miembro para acceder al foro.")).toBeVisible();
});

test("allows a seeded member to create a forum topic", async ({ page }) => {
  const topicTitle = `Tema E2E ${Date.now()}`;
  await page.goto("/auth");
  await page.getByLabel("Email").fill("xavidp@demo.magicsocial.local");
  await page.getByLabel("Contraseña").fill("MagicSocial123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/feed$/);

  await page.goto("/organizations/lliga-spellbook/forum");
  await page.getByLabel("Título").fill(topicTitle);
  await page.getByLabel("Mensaje").fill("Este mensaje verifica el flujo completo del foro de organizaciones.");
  await page.getByRole("button", { name: "Publicar tema" }).click();

  await expect(page.getByText(topicTitle, { exact: true }).first()).toBeVisible();
  if (/\/forum$/.test(page.url())) await page.getByRole("link", { name: new RegExp(topicTitle) }).click();
  await expect(page).toHaveURL(/\/organizations\/lliga-spellbook\/forum\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: topicTitle })).toBeVisible();

  await page.goto("/organizations/lliga-spellbook/members");
  await expect(page.getByRole("heading", { name: "Miembros" })).toBeVisible();
  await expect(page.getByText("Ariadna Serra")).toBeVisible();
});
