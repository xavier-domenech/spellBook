import { z } from "zod";
import { deckFormatSchema } from "@/features/decks/formats";

export const archetypeStatusSchema = z.enum(["provisional", "reviewed"]);

export const updateArchetypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(100, "El nombre no puede superar 100 caracteres."),
  slug: z.string().trim().toLowerCase().min(1, "El slug es obligatorio.").max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones en el slug."),
  description: z.string().trim().max(1000, "La descripción no puede superar 1.000 caracteres."),
  status: archetypeStatusSchema,
  filterFormat: deckFormatSchema.optional(),
  filterStatus: archetypeStatusSchema.optional(),
});
