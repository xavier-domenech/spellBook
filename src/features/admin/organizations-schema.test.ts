import { describe, expect, it } from "vitest";
import { adminOrganizationActionSchema, adminOrganizationListSchema, createAdminOrganizationSchema } from "./organizations-schema";

describe("admin organization schemas", () => {
  it("normalizes list filters", () => {
    expect(adminOrganizationListSchema.parse({ query: " league ", status: "archived", access: "private", page: "3" })).toEqual({
      query: "league", status: "archived", access: "private", page: 3,
    });
  });

  it("validates an administrative creation", () => {
    expect(createAdminOrganizationSchema.safeParse({
      ownerId: crypto.randomUUID(), name: "Liga local", slug: "liga-local", kind: "league", access: "public",
      description: "", websiteUrl: "", location: "", formats: ["commander"],
    }).success).toBe(true);
  });

  it("rejects invalid actions", () => {
    expect(adminOrganizationActionSchema.safeParse({ organizationId: "bad", slug: "liga" }).success).toBe(false);
  });
});

