import type { DeckFormat } from "@/features/decks/validation";
import { requireAdminAccess } from "./auth";
import type { z } from "zod";
import type { archetypeStatusSchema } from "./archetypes-schema";

export type AdminArchetype = {
  id: string;
  format: DeckFormat;
  name: string;
  slug: string;
  description: string;
  status: z.infer<typeof archetypeStatusSchema>;
  representative_version_id: string;
  deck_count: number;
};

export async function loadAdminArchetypes(filters: { format?: DeckFormat; status?: AdminArchetype["status"] } = {}) {
  const { supabase } = await requireAdminAccess();
  let query = supabase.from("archetype_catalog").select("*", { count: "exact" })
    .order("format").order("status").order("name").order("id").limit(200);
  if (filters.format) query = query.eq("format", filters.format);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error, count } = await query;
  if (error) throw new Error("No se pudieron cargar los arquetipos para administración.");
  return { archetypes: (data ?? []) as AdminArchetype[], count: count ?? 0 };
}
