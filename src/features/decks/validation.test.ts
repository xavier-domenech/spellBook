import { describe, expect, it } from "vitest";
import { validateDeckSize } from "./validation";

const constructed = { name: "Modern", mainboard_min: 60, mainboard_max: null, commander_min: 0, commander_max: 0, total_min: 60, total_max: null };
const commander = { name: "Commander", mainboard_min: 98, mainboard_max: 99, commander_min: 1, commander_max: 2, total_min: 100, total_max: 100 };

describe("deck size validation", () => {
  it("requires at least 60 mainboard cards in constructed formats", () => {
    expect(validateDeckSize(constructed, [{ zone: "mainboard", quantity: 60 }]).valid).toBe(true);
    expect(validateDeckSize(constructed, [{ zone: "mainboard", quantity: 59 }, { zone: "sideboard", quantity: 15 }])).toMatchObject({ valid: false, current: 59 });
    expect(validateDeckSize(constructed, [{ zone: "mainboard", quantity: 61 }]).valid).toBe(true);
  });

  it("requires exactly 100 cards between commander and mainboard", () => {
    expect(validateDeckSize(commander, [
      { zone: "commander", quantity: 1 },
      { zone: "mainboard", quantity: 99 },
      { zone: "sideboard", quantity: 10 },
    ])).toMatchObject({ valid: true, current: 100 });
    expect(validateDeckSize(commander, [{ zone: "mainboard", quantity: 99 }]).valid).toBe(false);
    expect(validateDeckSize(commander, [{ zone: "mainboard", quantity: 101 }]).valid).toBe(false);
  });
});
