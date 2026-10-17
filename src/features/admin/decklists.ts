import { requireAdminAccess } from "./auth";
import type { AdminDeckFilters } from "./decklists-schema";

export type AdminDeck = {
  id: string;
  owner_id: string;
  owner_handle: string;
  owner_name: string;
  title: string;
  format: string;
  format_name: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  moderation_status: "visible" | "hidden";
  moderation_reason: string;
  current_version: number;
  version_count: number;
  total_cards: number;
  post_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archive_reason: string;
  total_count: number;
};

export type DeckOwnerOption = { id: string; handle: string; display_name: string };
const pageSize = 30;

export async function loadAdminDecklists(filters: AdminDeckFilters) {
  const { supabase } = await requireAdminAccess();
  const [{ data, error }, ownersResult] = await Promise.all([
    supabase.rpc("get_admin_decks", {
      p_query: filters.query,
      p_format: filters.format,
      p_state: filters.state,
      p_limit: pageSize,
      p_offset: (filters.page - 1) * pageSize,
    }),
    supabase.from("profiles").select("id, handle, display_name").order("display_name").limit(200),
  ]);
  if (error) throw new Error("No se pudo cargar la administración de decklists.");
  if (ownersResult.error) throw new Error("No se pudieron cargar los propietarios disponibles.");
  const decks = (data ?? []) as AdminDeck[];
  return {
    decks,
    owners: (ownersResult.data ?? []) as DeckOwnerOption[],
    count: Number(decks[0]?.total_count ?? 0),
    pageSize,
  };
}
