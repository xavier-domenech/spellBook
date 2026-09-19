import { createClient } from "@/lib/supabase/server";
import type { DeckFormat } from "./validation";

export type LibraryDeck = {
  id: string;
  title: string;
  format: DeckFormat;
  description: string;
  current_version: number;
  display_name: string;
  handle: string;
  total_cards: number;
  cover_url: string | null;
  archetype_id: string | null;
  archetype_name: string | null;
  archetype_slug: string | null;
  similarity: number | null;
};

export type Archetype = {
  id: string;
  format: DeckFormat;
  name: string;
  slug: string;
  description: string;
  status: "provisional" | "reviewed";
  representative_version_id: string;
  deck_count: number;
};

export async function loadLibrary(format: DeckFormat, options: { page?: number; archetypeId?: string; unclassified?: boolean } = {}) {
  const supabase = await createClient();
  const pageSize = 24;
  const offset = ((options.page ?? 1) - 1) * pageSize;
  let query = supabase.from("deck_library").select("*", { count: "exact" })
    .eq("format", format).eq("visibility", "public")
    .order("updated_at", { ascending: false }).order("id")
    .range(offset, offset + pageSize - 1);
  if (options.archetypeId) query = query.eq("archetype_id", options.archetypeId);
  if (options.unclassified) query = query.is("archetype_id", null);
  const { data, error, count } = await query;
  return { decks: (data ?? []) as LibraryDeck[], count: count ?? 0, pageSize, error: Boolean(error) };
}

export async function loadArchetypes(format: DeckFormat, page = 1) {
  const supabase = await createClient();
  const { data, error, count } = await supabase.from("archetype_catalog").select("*", { count: "exact" })
    .eq("format", format).order("deck_count", { ascending: false }).order("name").order("id")
    .range((page - 1) * 24, page * 24 - 1);
  return { archetypes: (data ?? []) as Archetype[], error: Boolean(error), count: count ?? 0 };
}
