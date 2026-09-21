import { z } from "zod";
import { organizationAccessSchema, organizationFormSchema, organizationIdSchema, organizationKindSchema } from "@/features/organizations/schemas";

export const adminOrganizationListSchema = z.object({
  query: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "active", "archived"]).catch("all"),
  access: z.enum(["all", "public", "private"]).catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
});

export const createAdminOrganizationSchema = organizationFormSchema.extend({
  ownerId: organizationIdSchema,
});

export const updateAdminOrganizationSchema = organizationFormSchema.omit({ slug: true }).extend({
  organizationId: organizationIdSchema,
});

export const adminOrganizationActionSchema = z.object({
  organizationId: organizationIdSchema,
  slug: z.string().trim().min(3).max(50),
  reason: z.string().trim().max(500).default(""),
  archived: z.enum(["true", "false"]).optional(),
  userId: organizationIdSchema.optional(),
});

export { organizationAccessSchema, organizationKindSchema };

