import { describe, expect, it } from "vitest";
import { postContentSchema, profileSchema, userSearchSchema } from "./schemas";

describe("social schemas", () => {
  it("normalizes a valid profile", () => {
    const profile = profileSchema.parse({
      displayName: "  Lina Voss ",
      handle: "Lina_Voss",
      bio: "  Commander y café. ",
      favoriteFormats: ["commander", "modern"],
    });

    expect(profile).toEqual({
      displayName: "Lina Voss",
      handle: "lina_voss",
      bio: "Commander y café.",
      favoriteFormats: ["commander", "modern"],
    });
  });

  it("rejects unsafe handles and empty posts", () => {
    expect(profileSchema.safeParse({ displayName: "Lina", handle: "lina-voss", bio: "", favoriteFormats: [] }).success).toBe(false);
    expect(postContentSchema.safeParse("   ").success).toBe(false);
  });

  it("normalizes user searches", () => {
    expect(userSearchSchema.parse("  @Lina_Voss ")).toBe("lina_voss");
    expect(userSearchSchema.safeParse("lina-voss").success).toBe(false);
  });
});
