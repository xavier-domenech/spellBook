import { describe, expect, it } from "vitest";
import { adminDeckActionSchema, adminDeckListSchema, createAdminDeckSchema } from "./decklists-schema";

const card = {
  quantity: 1,
  zone: "mainboard",
  scryfallId: crypto.randomUUID(),
  oracleId: crypto.randomUUID(),
  canonicalName: "Forest",
  imageSmall: null,
  imageNormal: null,
};

describe("admin decklist schemas", () => {
  it("normalizes list filters", () => {
    expect(adminDeckListSchema.parse({ query: "  control ", format: "standard", state: "hidden", page: "2" })).toEqual({
      query: "control",
      format: "standard",
      state: "hidden",
      page: 2,
    });
  });

  it("parses a preview payload for creation", () => {
    const result = createAdminDeckSchema.parse({
      ownerId: crypto.randomUUID(),
      title: "Admin deck",
      format: "standard",
      visibility: "private",
      description: "",
      note: "Initial",
      cards: JSON.stringify([card]),
    });
    expect(result.cards).toEqual([card]);
  });

  it("rejects malformed or unresolved cards", () => {
    const base = { ownerId: crypto.randomUUID(), title: "Deck", format: "standard", visibility: "public", description: "", note: "" };
    expect(createAdminDeckSchema.safeParse({ ...base, cards: "{" }).success).toBe(false);
    expect(createAdminDeckSchema.safeParse({ ...base, cards: JSON.stringify([{ ...card, scryfallId: "missing" }]) }).success).toBe(false);
  });

  it("requires valid moderation actions", () => {
    expect(adminDeckActionSchema.safeParse({ deckId: crypto.randomUUID(), enabled: "true", reason: "Policy violation" }).success).toBe(true);
    expect(adminDeckActionSchema.safeParse({ deckId: "invalid", reason: "Policy violation" }).success).toBe(false);
  });
});
