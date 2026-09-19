import { describe, expect, it } from "vitest";
import { formatMagicArenaDeck } from "./export";

describe("formatMagicArenaDeck", () => {
  it("exports an Arena deck with metadata, main deck and sideboard", () => {
    expect(formatMagicArenaDeck("Mono-Green Landfall", [
      { zone: "mainboard", quantity: 4, name: "Llanowar Elves" },
      { zone: "mainboard", quantity: 14, name: "Forest" },
      { zone: "sideboard", quantity: 2, name: "Torpor Orb" },
    ])).toBe(`About
Name Mono-Green Landfall

Deck
4 Llanowar Elves
14 Forest

Sideboard
2 Torpor Orb`);
  });

  it("keeps Commander and maybeboard sections when present", () => {
    expect(formatMagicArenaDeck("  Atraxa\nCounters  ", [
      { zone: "commander", quantity: 1, name: "Atraxa, Praetors' Voice" },
      { zone: "mainboard", quantity: 1, name: "Sol Ring" },
      { zone: "maybeboard", quantity: 1, name: "Evolution Sage" },
      { zone: "unknown", quantity: 1, name: "Ignored card" },
    ])).toBe(`About
Name Atraxa Counters

Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring

Maybeboard
1 Evolution Sage`);
  });
});
