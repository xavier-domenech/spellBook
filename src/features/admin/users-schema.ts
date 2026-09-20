import { z } from "zod";

export const adminUserStatusSchema = z.enum(["all", "active", "pending", "suspended"]);

export const adminUserListSchema = z.object({
  query: z.string().trim().max(100).catch(""),
  status: adminUserStatusSchema.catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un email válido.").max(254),
  displayName: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
});

export const updateAdminUserSchema = z.object({
  userId: z.string().uuid(),
  handle: z.string().trim().regex(/^[a-zA-Z0-9_]{3,30}$/, "El handle debe tener entre 3 y 30 letras, números o guiones bajos."),
  displayName: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
  bio: z.string().trim().max(300),
});

export const adminUserActionSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().max(500).default(""),
  enabled: z.enum(["true", "false"]).optional(),
});

