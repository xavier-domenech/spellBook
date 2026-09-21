import { requireAdminAccess } from "./auth";
import type { z } from "zod";
import type { adminUserListSchema } from "./users-schema";

export type AdminUser = {
  id: string;
  email: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  account_status: "active" | "pending" | "suspended";
  is_admin: boolean;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  deck_count: number;
  post_count: number;
  organization_count: number;
  total_count: number;
};

export type AdminUserFilters = z.infer<typeof adminUserListSchema>;

const pageSize = 30;

export async function loadAdminUsers(filters: AdminUserFilters) {
  const { supabase } = await requireAdminAccess();
  const { data, error } = await supabase.rpc("get_admin_users", {
    p_query: filters.query,
    p_status: filters.status,
    p_limit: pageSize,
    p_offset: (filters.page - 1) * pageSize,
  });
  if (error) throw new Error("No se pudo cargar la administración de usuarios.");
  const users = (data ?? []) as AdminUser[];
  return { users, count: Number(users[0]?.total_count ?? 0), pageSize };
}

