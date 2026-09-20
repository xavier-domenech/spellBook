import type { FormatRules } from "@/features/formats/types";

export type DeckFormat = string;

type CountableCard = {
  zone: string;
  quantity: number;
};

export type DeckSizeValidation = {
  valid: boolean;
  current: number;
  required: number;
  message: string;
};

export function validateDeckSize(rules: FormatRules, cards: CountableCard[]): DeckSizeValidation {
  const mainboard = cards.reduce((total, card) => card.zone === "mainboard" ? total + card.quantity : total, 0);
  const commanders = cards.reduce((total, card) => card.zone === "commander" ? total + card.quantity : total, 0);
  const current = mainboard + commanders;
  const mainboardValid = mainboard >= rules.mainboard_min && (rules.mainboard_max === null || mainboard <= rules.mainboard_max);
  const commandersValid = commanders >= rules.commander_min && commanders <= rules.commander_max;
  const totalValid = current >= rules.total_min && (rules.total_max === null || current <= rules.total_max);
  const valid = mainboardValid && commandersValid && totalValid;
  const required = rules.total_min;
  const totalRule = rules.total_max === rules.total_min ? `exactamente ${rules.total_min}` : `un mínimo de ${rules.total_min}`;
  const commanderRule = rules.commander_max > 0
    ? ` y entre ${rules.commander_min} y ${rules.commander_max} comandantes`
    : " y ninguna carta en la zona de comandante";
  const message = `${rules.name} necesita ${totalRule} cartas${commanderRule}. Ahora hay ${current}.`;

  return { valid, current, required, message };
}
