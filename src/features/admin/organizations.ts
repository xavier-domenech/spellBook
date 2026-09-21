import { requireAdminAccess } from "./auth";
import type { z } from "zod";
import type { adminOrganizationListSchema } from "./organizations-schema";

export type AdminOrganization = {
  id: string;
  slug: string;
  name: string;
  kind: "league" | "team" | "club" | "store" | "community";
  access: "public" | "private";
  description: string;
  website_url: string | null;
  location: string | null;
  formats: string[];
  creator_handle: string;
  owner_handles: string;
  member_count: number;
  pending_request_count: number;
  topic_count: number;
  announcement_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archive_reason: string;
  total_count: number;
};

export type OrganizationOwnerOption = { id: string; handle: string; display_name: string };
export type AdminOrganizationFilters = z.infer<typeof adminOrganizationListSchema>;
const pageSize = 30;

export async function loadAdminOrganizations(filters: AdminOrganizationFilters) {
  const { supabase } = await requireAdminAccess();
  const [{ data, error }, ownersResult] = await Promise.all([
    supabase.rpc("get_admin_organizations", {
      p_query: filters.query,
      p_status: filters.status,
      p_access: filters.access,
      p_limit: pageSize,
      p_offset: (filters.page - 1) * pageSize,
    }),
    supabase.from("profiles").select("id, handle, display_name").order("display_name").limit(200),
  ]);
  if (error) throw new Error("No se pudo cargar la administración de organizaciones.");
  if (ownersResult.error) throw new Error("No se pudieron cargar los propietarios disponibles.");
  const organizations = (data ?? []) as AdminOrganization[];
  return {
    organizations,
    owners: (ownersResult.data ?? []) as OrganizationOwnerOption[],
    count: Number(organizations[0]?.total_count ?? 0),
    pageSize,
  };
}
