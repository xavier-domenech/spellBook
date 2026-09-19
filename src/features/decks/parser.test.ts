import { describe, expect, it } from "vitest";
import { parseDeckList } from "./parser";

describe("parseDeckList", () => {
  it("parses common sections and Arena printing suffixes", () => {
    const result = parseDeckList(`
Commander
1 Atraxa, Praetors' Voice

Deck
4 Sol Ring (CMM) 396
2x Arcane Signet

Sideboard:
1 Negate
`);

    expect(result.invalidLines).toEqual([]);
    expect(result.totalCards).toBe(8);
    expect(result.cards).toEqual([
      { quantity: 1, name: "Atraxa, Praetors' Voice", zone: "commander" },
      { quantity: 4, name: "Sol Ring", zone: "mainboard" },
      { quantity: 2, name: "Arcane Signet", zone: "mainboard" },
      { quantity: 1, name: "Negate", zone: "sideboard" },
    ]);
  });

  it("groups duplicate cards in the same zone", () => {
    const result = parseDeckList("2 Island\n3 Island\nSideboard\n1 Island");

    expect(result.cards).toEqual([
      { quantity: 5, name: "Island", zone: "mainboard" },
      { quantity: 1, name: "Island", zone: "sideboard" },
    ]);
  });

  it("reports invalid lines without dropping valid cards", () => {
    const result = parseDeckList("Lightning Bolt\n4 Counterspell\n0 Island");

    expect(result.cards).toEqual([
      { quantity: 4, name: "Counterspell", zone: "mainboard" },
    ]);
    expect(result.invalidLines).toEqual(["Lightning Bolt", "0 Island"]);
  });

  it("imports Arena metadata, main deck and sideboard", () => {
    const result = parseDeckList(`About
Name Mono-Green Landfall

Deck
4 Fabled Passage
2 Elven Passage
2 Escape Tunnel
3 Ba Sing Se
14 Forest
1 Bushwhack
4 Llanowar Elves
4 Sazh's Chocobo
4 Esper Origins
4 Icetill Explorer
1 Lumbering Worldwagon
1 Surrak, Elusive Hunter
1 Meltstrider's Resolve
4 Earthbender Ascension
2 Glimpse the Core
1 Keen-Eyed Curator
4 Mightform Harmonizer
3 Sapling Nursery
1 Promising Vein

Sideboard
3 Meltstrider's Gear
1 Keen-Eyed Curator
2 Torpor Orb
1 The Scouring Stormsoul
2 Surrak, Elusive Hunter
4 Mossborn Hydra
1 Leatherhead, Swamp Stalker
1 Sapling Nursery`);

    expect(result.suggestedTitle).toBe("Mono-Green Landfall");
    expect(result.invalidLines).toEqual([]);
    expect(result.totalCards).toBe(75);
    expect(result.cards.filter((card) => card.zone === "mainboard").reduce((sum, card) => sum + card.quantity, 0)).toBe(60);
    expect(result.cards.filter((card) => card.zone === "sideboard").reduce((sum, card) => sum + card.quantity, 0)).toBe(15);
    expect(result.cards).toContainEqual({ quantity: 1, name: "Surrak, Elusive Hunter", zone: "mainboard" });
    expect(result.cards).toContainEqual({ quantity: 2, name: "Surrak, Elusive Hunter", zone: "sideboard" });
  });
});
