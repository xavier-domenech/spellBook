export type MagicFormat = {
  slug: string;
  name: string;
  description: string;
  rules_summary: string;
  mainboard_min: number;
  mainboard_max: number | null;
  commander_min: number;
  commander_max: number;
  total_min: number;
  total_max: number | null;
  sort_order: number;
  is_active: boolean;
};

export type FormatRules = Pick<MagicFormat,
  | "name"
  | "mainboard_min"
  | "mainboard_max"
  | "commander_min"
  | "commander_max"
  | "total_min"
  | "total_max"
>;
