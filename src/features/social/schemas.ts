import { z } from "zod";
import { formatSelectionSchema } from "@/features/formats/schemas";

export const postIdSchema = z.string().uuid();
export const postContentSchema = z.string().trim().min(1).max(500);
export const postVisibilitySchema = z.enum(["public", "followers", "private"]);
export const handleSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/);
export const magicFormatSchema = z.string().trim().toLowerCase().min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const userSearchSchema = z.string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(z.string().max(30).regex(/^[a-z0-9_]*$/));

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  handle: handleSchema,
  bio: z.string().trim().max(300),
  favoriteFormats: formatSelectionSchema,
});
