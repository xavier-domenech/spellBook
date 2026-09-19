export const deckZones = ["commander", "mainboard", "sideboard", "maybeboard"] as const;
export type DeckZone = (typeof deckZones)[number];

export type ParsedDeckCard = {
  quantity: number;
  name: string;
  zone: DeckZone;
};

export type DeckParseResult = {
  cards: ParsedDeckCard[];
  invalidLines: string[];
  suggestedTitle: string | null;
  totalCards: number;
};

const headings: Record<string, DeckZone> = {
  commander: "commander",
  commanders: "commander",
  deck: "mainboard",
  main: "mainboard",
  mainboard: "mainboard",
  mazo: "mainboard",
  side: "sideboard",
  sideboard: "sideboard",
  banquillo: "sideboard",
  maybeboard: "maybeboard",
  considering: "maybeboard",
  considerando: "maybeboard",
};

function normalizeHeading(line: string) {
  return line.toLowerCase().replace(/[:\s]+$/g, "").trim();
}

function stripPrintingSuffix(name: string) {
  return name
    .replace(/\s+\([a-z0-9]{2,8}\)\s+[a-z0-9-]+\s*$/i, "")
    .replace(/\s+\[[a-z0-9]{2,8}\]\s*$/i, "")
    .trim();
}

export function parseDeckList(input: string): DeckParseResult {
  let zone: DeckZone = "mainboard";
  let suggestedTitle: string | null = null;
  const invalidLines: string[] = [];
  const grouped = new Map<string, ParsedDeckCard>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;

    if (normalizeHeading(line) === "about") continue;

    const nameLine = line.match(/^(?:name|nombre)(?:\s*:\s*|\s+)(.+)$/i);
    if (nameLine) {
      suggestedTitle = nameLine[1].trim().slice(0, 100) || null;
      continue;
    }

    const heading = headings[normalizeHeading(line)];
    if (heading) {
      zone = heading;
      continue;
    }

    const match = line.match(/^(\d{1,3})\s*[xX]?\s+(.+)$/);
    if (!match) {
      invalidLines.push(rawLine);
      continue;
    }

    const quantity = Number(match[1]);
    const name = stripPrintingSuffix(match[2]);
    if (!name || quantity < 1 || quantity > 100) {
      invalidLines.push(rawLine);
      continue;
    }

    const key = `${zone}:${name.toLocaleLowerCase("en-US")}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += quantity;
    else grouped.set(key, { quantity, name, zone });
  }

  const cards = [...grouped.values()];
  return {
    cards,
    invalidLines,
    suggestedTitle,
    totalCards: cards.reduce((total, card) => total + card.quantity, 0),
  };
}
