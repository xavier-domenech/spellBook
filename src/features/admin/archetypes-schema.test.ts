import { describe, expect, it } from "vitest";
import { updateArchetypeSchema } from "./archetypes-schema";

const validArchetype = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Izzet Delirium",
  slug: "izzet-delirium",
  description: "Amenazas eficientes y uso del cementerio.",
  status: "reviewed",
};

describe("updateArchetypeSchema", () => {
  it("normalizes editable archetype metadata", () => {
    expect(updateArchetypeSchema.parse({ ...validArchetype, slug: "  izzet-delirium  " }).slug).toBe("izzet-delirium");
  });

  it("rejects unsafe slugs and oversized descriptions", () => {
    expect(updateArchetypeSchema.safeParse({ ...validArchetype, slug: "Izzet Delirium" }).success).toBe(false);
    expect(updateArchetypeSchema.safeParse({ ...validArchetype, description: "x".repeat(1001) }).success).toBe(false);
  });
});
