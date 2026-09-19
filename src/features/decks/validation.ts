export const deckFormats = ["commander", "standard", "modern", "pioneer"] as const;
export type DeckFormat = (typeof deckFormats)[number];

type CountableCard = {
  zone: string;
  quantity: number;
};

const formatLabels: Record<DeckFormat, string> = {
  commander: "Commander",
  standard: "Standard",
  modern: "Modern",
  pioneer: "Pioneer",
};

export type DeckSizeValidation = {
  valid: boolean;
  current: number;
  required: number;
  message: string;
};

export function validateDeckSize(format: DeckFormat, cards: CountableCard[]): DeckSizeValidation {
  const zones = format === "commander" ? new Set(["commander", "mainboard"]) : new Set(["mainboard"]);
  const current = cards.reduce((total, card) => zones.has(card.zone) ? total + card.quantity : total, 0);
  const required = format === "commander" ? 100 : 60;
  const valid = format === "commander" ? current === required : current >= required;
  const message = format === "commander"
    ? `Commander necesita exactamente 100 cartas entre comandante y mazo principal. Ahora hay ${current}.`
    : `${formatLabels[format]} necesita un mínimo de 60 cartas en el mazo principal. Ahora hay ${current}.`;

  return { valid, current, required, message };
}
