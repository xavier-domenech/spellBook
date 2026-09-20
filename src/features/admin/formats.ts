import { requireAdminAccess } from "./auth";

export type AdminFormat = {
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
  created_at: string;
  updated_at: string;
  deck_count: number;
  archetype_count: number;
  profile_count: number;
  organization_count: number;
};

export async function loadAdminFormats() {
  const { supabase } = await requireAdminAccess();
  const { data, error } = await supabase.rpc("get_admin_formats");
  if (error) throw new Error("No se pudo cargar la administración de formatos.");
  return (data ?? []) as AdminFormat[];
}
