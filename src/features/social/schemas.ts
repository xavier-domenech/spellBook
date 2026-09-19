import { z } from "zod";

export const postIdSchema = z.string().uuid();
export const postContentSchema = z.string().trim().min(1).max(500);
export const postVisibilitySchema = z.enum(["public", "followers", "private"]);
export const handleSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/);
export const magicFormatSchema = z.enum(["commander", "standard", "modern", "pioneer"]);
export const userSearchSchema = z.string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(z.string().max(30).regex(/^[a-z0-9_]*$/));

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  handle: handleSchema,
  bio: z.string().trim().max(300),
  favoriteFormats: z.array(magicFormatSchema).max(4),
});
