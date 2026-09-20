import { z } from "zod";

export const formatSlugSchema = z.string().trim().toLowerCase()
  .min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const formatSelectionSchema = z.array(formatSlugSchema).max(8)
  .refine((formats) => new Set(formats).size === formats.length, "No repitas formatos.");
