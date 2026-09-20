import { z } from "zod";

const uuidSchema = z.string().uuid();
const visibilitySchema = z.enum(["public", "unlisted", "private"]);

export const adminDeckListSchema = z.object({
  query: z.string().trim().max(100).catch(""),
  format: z.string().trim().max(50).catch("all"),
  state: z.enum(["all", "active", "hidden", "archived"]).catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
});

export const adminDeckCardSchema = z.object({
  quantity: z.number().int().min(1).max(100),
  zone: z.enum(["commander", "mainboard", "sideboard", "maybeboard"]),
  scryfallId: uuidSchema,
  oracleId: uuidSchema.nullable(),
  canonicalName: z.string().trim().min(1).max(300),
  imageSmall: z.url().nullable(),
  imageNormal: z.url().nullable(),
});

const cardsJsonSchema = z.string().max(500_000).transform((value, context) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    context.addIssue({ code: "custom", message: "Previsualiza una lista de cartas válida." });
    return z.NEVER;
  }
}).pipe(z.array(adminDeckCardSchema).min(1).max(500));

export const createAdminDeckSchema = z.object({
  ownerId: uuidSchema,
  title: z.string().trim().min(1).max(100),
  format: z.string().trim().min(1).max(50),
  visibility: visibilitySchema,
  description: z.string().trim().max(2000).default(""),
  note: z.string().trim().max(500).default(""),
  cards: cardsJsonSchema,
});

export const createAdminDeckVersionSchema = z.object({
  deckId: uuidSchema,
  note: z.string().trim().max(500).default(""),
  cards: cardsJsonSchema,
});

export const updateAdminDeckSchema = z.object({
  deckId: uuidSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).default(""),
  visibility: visibilitySchema,
});

export const adminDeckActionSchema = z.object({
  deckId: uuidSchema,
  ownerId: uuidSchema.optional(),
  enabled: z.enum(["true", "false"]).optional(),
  reason: z.string().trim().max(500).default(""),
});

export type AdminDeckFilters = z.infer<typeof adminDeckListSchema>;
export type AdminDeckCard = z.infer<typeof adminDeckCardSchema>;
