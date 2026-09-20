import { describe, expect, it } from "vitest";
import { adminUserActionSchema, adminUserListSchema, inviteUserSchema, updateAdminUserSchema } from "./users-schema";

describe("admin user schemas", () => {
  it("normalizes list filters", () => {
    expect(adminUserListSchema.parse({ query: "  mage ", status: "suspended", page: "2" })).toEqual({
      query: "mage",
      status: "suspended",
      page: 2,
    });
  });

  it("validates invitations", () => {
    expect(inviteUserSchema.parse({ email: " ADMIN@Example.com ", displayName: "Ada" }).email).toBe("admin@example.com");
    expect(inviteUserSchema.safeParse({ email: "invalid", displayName: "Ada" }).success).toBe(false);
  });

  it("rejects invalid public profiles", () => {
    expect(updateAdminUserSchema.safeParse({ userId: crypto.randomUUID(), handle: "a", displayName: "Ada", bio: "" }).success).toBe(false);
    expect(updateAdminUserSchema.safeParse({ userId: crypto.randomUUID(), handle: "ada_1", displayName: "", bio: "" }).success).toBe(false);
  });

  it("limits moderation reasons", () => {
    expect(adminUserActionSchema.safeParse({ userId: crypto.randomUUID(), reason: "x".repeat(501) }).success).toBe(false);
  });
});

