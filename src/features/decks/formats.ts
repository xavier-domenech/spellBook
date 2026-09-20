import { z } from "zod";
import { formatSlugSchema } from "@/features/formats/schemas";

export const deckFormatSchema = formatSlugSchema;

export const pageNumberSchema = z.coerce.number().int().min(1).max(10000).catch(1);

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
