export type ExportableDeckCard = {
  zone: string;
  quantity: number;
  name: string;
};

const arenaSections = [
  { zone: "commander", heading: "Commander" },
  { zone: "mainboard", heading: "Deck" },
  { zone: "sideboard", heading: "Sideboard" },
  { zone: "maybeboard", heading: "Maybeboard" },
] as const;

export function formatMagicArenaDeck(title: string, cards: ExportableDeckCard[]) {
  const safeTitle = title.replace(/\s+/g, " ").trim();
  const lines = ["About", `Name ${safeTitle}`];

  for (const section of arenaSections) {
    const sectionCards = cards.filter((card) => card.zone === section.zone && card.quantity > 0 && card.name.trim());
    if (sectionCards.length === 0) continue;

    lines.push("", section.heading);
    for (const card of sectionCards) lines.push(`${card.quantity} ${card.name.trim()}`);
  }

  return lines.join("\n");
}
