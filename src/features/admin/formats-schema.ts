import { z } from "zod";
import { formatSlugSchema } from "@/features/formats/schemas";

const integerField = z.coerce.number().int().min(0).max(10000);
const optionalIntegerField = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : value,
  z.coerce.number().int().min(0).max(500).nullable(),
);

export const formatFormSchema = z.object({
  slug: formatSlugSchema,
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
  description: z.string().trim().max(1000),
  rulesSummary: z.string().trim().max(200),
  mainboardMin: integerField.max(500),
  mainboardMax: optionalIntegerField,
  commanderMin: integerField.max(10),
  commanderMax: integerField.max(10),
  totalMin: integerField.min(1).max(500),
  totalMax: optionalIntegerField,
  sortOrder: integerField,
  isActive: z.boolean(),
}).superRefine((value, context) => {
  if (value.mainboardMax !== null && value.mainboardMax < value.mainboardMin) {
    context.addIssue({ code: "custom", path: ["mainboardMax"], message: "El máximo principal no puede ser menor que el mínimo." });
  }
  if (value.commanderMax < value.commanderMin) {
    context.addIssue({ code: "custom", path: ["commanderMax"], message: "El máximo de comandantes no puede ser menor que el mínimo." });
  }
  if (value.totalMax !== null && value.totalMax < value.totalMin) {
    context.addIssue({ code: "custom", path: ["totalMax"], message: "El máximo total no puede ser menor que el mínimo." });
  }
  if (value.totalMin < value.mainboardMin + value.commanderMin) {
    context.addIssue({ code: "custom", path: ["totalMin"], message: "El mínimo total no cubre las zonas obligatorias." });
  }
});

export const formatActionSchema = z.object({
  slug: formatSlugSchema,
  nextActive: z.enum(["true", "false"]).optional(),
});
