import { describe, expect, it } from "vitest";
import { formatFormSchema } from "./formats-schema";

const validFormat = {
  slug: "pauper",
  name: "Pauper",
  description: "Cartas comunes.",
  rulesSummary: "Mínimo 60 cartas principales",
  mainboardMin: "60",
  mainboardMax: "",
  commanderMin: "0",
  commanderMax: "0",
  totalMin: "60",
  totalMax: "",
  sortOrder: "50",
  isActive: true,
};

describe("formatFormSchema", () => {
  it("normalizes a dynamic format and nullable limits", () => {
    const parsed = formatFormSchema.parse({ ...validFormat, slug: "  pauper  " });
    expect(parsed.slug).toBe("pauper");
    expect(parsed.mainboardMax).toBeNull();
    expect(parsed.totalMax).toBeNull();
  });

  it("rejects inconsistent limits", () => {
    expect(formatFormSchema.safeParse({ ...validFormat, totalMin: "59" }).success).toBe(false);
    expect(formatFormSchema.safeParse({ ...validFormat, commanderMin: "2", commanderMax: "1" }).success).toBe(false);
  });
});
