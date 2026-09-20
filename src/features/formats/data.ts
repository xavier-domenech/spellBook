import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { MagicFormat } from "./types";

export const fallbackFormats: MagicFormat[] = [
  { slug: "commander", name: "Commander", description: "Encuentra listas alrededor de tu comandante y descubre nuevas construcciones.", rules_summary: "100 cartas, comandante incluido", mainboard_min: 98, mainboard_max: 99, commander_min: 1, commander_max: 2, total_min: 100, total_max: 100, sort_order: 10, is_active: true },
  { slug: "standard", name: "Standard", description: "Descubre las construcciones de la comunidad en el formato rotativo.", rules_summary: "Mínimo 60 cartas principales", mainboard_min: 60, mainboard_max: null, commander_min: 0, commander_max: 0, total_min: 60, total_max: null, sort_order: 20, is_active: true },
  { slug: "modern", name: "Modern", description: "Explora estrategias, variantes y listas de Modern.", rules_summary: "Mínimo 60 cartas principales", mainboard_min: 60, mainboard_max: null, commander_min: 0, commander_max: 0, total_min: 60, total_max: null, sort_order: 30, is_active: true },
  { slug: "pioneer", name: "Pioneer", description: "Comparte tus ideas y encuentra otras versiones de tu estrategia en Pioneer.", rules_summary: "Mínimo 60 cartas principales", mainboard_min: 60, mainboard_max: null, commander_min: 0, commander_max: 0, total_min: 60, total_max: null, sort_order: 40, is_active: true },
];

const columns = "slug, name, description, rules_summary, mainboard_min, mainboard_max, commander_min, commander_max, total_min, total_max, sort_order, is_active";

export async function loadFormats(options: { includeArchived?: boolean } = {}) {
  if (!hasSupabaseEnv()) return fallbackFormats.filter((format) => options.includeArchived || format.is_active);
  const supabase = await createClient();
  let query = supabase.from("formats").select(columns).order("sort_order").order("name").order("slug");
  if (!options.includeArchived) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar el catálogo de formatos.");
  return (data ?? []) as MagicFormat[];
}

export async function loadFormat(slug: string, options: { includeArchived?: boolean } = {}) {
  if (!hasSupabaseEnv()) {
    return fallbackFormats.find((format) => format.slug === slug && (options.includeArchived || format.is_active)) ?? null;
  }
  const supabase = await createClient();
  let query = supabase.from("formats").select(columns).eq("slug", slug);
  if (!options.includeArchived) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("No se pudo cargar el formato.");
  return data as MagicFormat | null;
}
