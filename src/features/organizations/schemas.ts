import { z } from "zod";
import { formatSelectionSchema } from "@/features/formats/schemas";

export const organizationKindSchema = z.enum(["league", "team", "club", "store", "community"]);
export const organizationAccessSchema = z.enum(["public", "private"]);
export const organizationRoleSchema = z.enum(["owner", "admin", "member"]);
export const organizationIdSchema = z.string().uuid();
export const organizationSlugSchema = z.string().trim().toLowerCase()
  .min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*$/);

const optionalUrlSchema = z.string().trim().max(500)
  .refine((value) => {
    if (value === "") return true;
    const parsed = z.url().safeParse(value);
    if (!parsed.success) return false;
    const protocol = new URL(parsed.data).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Introduce una URL http o https válida.");

export const organizationFormSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: organizationSlugSchema,
  kind: organizationKindSchema,
  access: organizationAccessSchema,
  description: z.string().trim().max(1000),
  websiteUrl: optionalUrlSchema,
  location: z.string().trim().max(120),
  formats: formatSelectionSchema,
});

export const organizationSearchSchema = z.string().trim().max(80);
export const organizationRequestSchema = z.object({
  organizationId: organizationIdSchema,
  slug: organizationSlugSchema,
  message: z.string().trim().max(500),
});
export const organizationRequestDecisionSchema = z.object({
  requestId: organizationIdSchema,
  slug: organizationSlugSchema,
  decision: z.enum(["approve", "reject"]),
});
export const organizationMemberActionSchema = z.object({
  organizationId: organizationIdSchema,
  userId: organizationIdSchema,
  slug: organizationSlugSchema,
});
export const organizationRoleChangeSchema = organizationMemberActionSchema.extend({
  role: organizationRoleSchema,
});
export const forumTopicSchema = z.object({
  organizationId: organizationIdSchema,
  slug: organizationSlugSchema,
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
});
export const forumMessageSchema = z.object({
  topicId: organizationIdSchema,
  slug: organizationSlugSchema,
  body: z.string().trim().min(1).max(5000),
});
export const forumModerationSchema = z.object({
  topicId: organizationIdSchema,
  slug: organizationSlugSchema,
  action: z.enum(["pin", "unpin", "lock", "unlock", "hide", "restore"]),
});
export const announcementSchema = z.object({
  organizationId: organizationIdSchema,
  slug: organizationSlugSchema,
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
  isPinned: z.boolean(),
});

export function slugifyOrganizationName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}
