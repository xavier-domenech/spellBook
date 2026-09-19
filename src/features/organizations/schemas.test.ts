import { describe, expect, it } from "vitest";
import { organizationFormSchema, organizationRequestSchema, slugifyOrganizationName } from "./schemas";

describe("organization schemas", () => {
  it("accepts a complete organization", () => {
    const parsed = organizationFormSchema.safeParse({
      name: "Lliga Catalana",
      slug: "lliga-catalana",
      kind: "league",
      access: "public",
      description: "Una liga de Old School.",
      websiteUrl: "https://oldschool.cat/",
      location: "Barcelona",
      formats: ["commander", "modern"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsafe slugs and invalid URLs", () => {
    expect(organizationFormSchema.safeParse({
      name: "Equipo ejemplo",
      slug: "../../admin",
      kind: "team",
      access: "private",
      description: "",
      websiteUrl: "not-a-url",
      location: "",
      formats: [],
    }).success).toBe(false);
    expect(organizationFormSchema.safeParse({
      name: "Equipo ejemplo",
      slug: "equipo-ejemplo",
      kind: "team",
      access: "public",
      description: "",
      websiteUrl: "javascript:alert(1)",
      location: "",
      formats: [],
    }).success).toBe(false);
  });

  it("limits private access requests", () => {
    expect(organizationRequestSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      slug: "private-team",
      message: "x".repeat(501),
    }).success).toBe(false);
  });

  it("creates URL-safe slugs from display names", () => {
    expect(slugifyOrganizationName("Lliga Catalana d'Old School")).toBe("lliga-catalana-d-old-school");
  });
});
