import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const getAdminAccess = cache(async () => {
  if (!hasSupabaseEnv()) return { user: null, isAdmin: false, supabase: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, supabase };

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) throw new Error("No se pudo comprobar el acceso de administración.");
  return { user, isAdmin: isAdmin === true, supabase };
});

export async function requireAdminAccess() {
  const access = await getAdminAccess();
  if (!access.user) redirect("/auth?message=Inicia sesión para acceder a la administración.");
  if (!access.isAdmin || !access.supabase) notFound();
  return { user: access.user, supabase: access.supabase };
}
