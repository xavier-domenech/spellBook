"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/features/admin/auth";
import { adminUserActionSchema, inviteUserSchema, updateAdminUserSchema } from "@/features/admin/users-schema";
import { createAdminClient } from "@/lib/supabase/admin";

function usersUrl(values: { saved?: string; created?: string; deleted?: string; error?: string }) {
  const params = new URLSearchParams();
  if (values.saved) params.set("saved", values.saved);
  if (values.created) params.set("created", values.created);
  if (values.deleted) params.set("deleted", values.deleted);
  if (values.error) params.set("error", values.error);
  const query = params.toString();
  return `/admin/users${query ? `?${query}` : ""}`;
}

function revalidateUsers(handle?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/users");
  if (handle) revalidatePath(`/u/${handle}`);
}

export async function inviteUser(formData: FormData) {
  const parsed = inviteUserSchema.safeParse({ email: formData.get("email"), displayName: formData.get("displayName") });
  if (!parsed.success) redirect(usersUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos de la invitación." }));
  const { supabase } = await requireAdminAccess();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { display_name: parsed.data.displayName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth`,
  });
  if (error || !data.user) {
    const message = error?.message.toLowerCase().includes("already") ? "Ya existe una cuenta con ese email." : "No se pudo enviar la invitación.";
    redirect(usersUrl({ error: message }));
  }
  await supabase.rpc("admin_log_user_invited", { p_user_id: data.user.id });
  revalidateUsers();
  redirect(usersUrl({ created: parsed.data.email }));
}

export async function updateUserProfile(formData: FormData) {
  const parsed = updateAdminUserSchema.safeParse({
    userId: formData.get("userId"),
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) redirect(usersUrl({ error: parsed.error.issues[0]?.message ?? "Revisa el perfil." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_update_user_profile", {
    p_user_id: parsed.data.userId,
    p_handle: parsed.data.handle,
    p_display_name: parsed.data.displayName,
    p_bio: parsed.data.bio,
  });
  if (error) {
    const message = error.code === "23505" ? "Ese handle ya está en uso." : "No se pudo actualizar el perfil.";
    redirect(usersUrl({ error: message }));
  }
  revalidateUsers(parsed.data.handle);
  redirect(usersUrl({ saved: parsed.data.handle }));
}

export async function setUserRole(formData: FormData) {
  const parsed = adminUserActionSchema.safeParse({ userId: formData.get("userId"), enabled: formData.get("enabled") });
  if (!parsed.success || parsed.data.enabled === undefined) redirect(usersUrl({ error: "La acción de rol no es válida." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: parsed.data.userId,
    p_enabled: parsed.data.enabled === "true",
  });
  if (error) {
    const message = error.message.includes("last administrator") ? "No se puede retirar el último administrador." : "No se pudo cambiar el rol.";
    redirect(usersUrl({ error: message }));
  }
  revalidateUsers();
  redirect(usersUrl({ saved: "rol" }));
}

export async function setUserSuspended(formData: FormData) {
  const parsed = adminUserActionSchema.safeParse({ userId: formData.get("userId"), reason: formData.get("reason") ?? "" });
  const suspended = formData.get("suspended") === "true";
  if (!parsed.success || (suspended && parsed.data.reason.length < 3)) {
    redirect(usersUrl({ error: suspended ? "Indica un motivo de al menos 3 caracteres." : "La acción no es válida." }));
  }
  const { supabase } = await requireAdminAccess();
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: suspended ? "876000h" : "none",
  });
  if (authError) redirect(usersUrl({ error: "No se pudo cambiar el acceso en Supabase Auth." }));

  const { error } = await supabase.rpc("admin_set_user_state", {
    p_user_id: parsed.data.userId,
    p_status: suspended ? "suspended" : "active",
    p_reason: parsed.data.reason,
  });
  if (error) {
    await admin.auth.admin.updateUserById(parsed.data.userId, { ban_duration: suspended ? "none" : "876000h" });
    const message = error.message.includes("themselves") ? "No puedes suspender tu propia cuenta." : "No se pudo guardar el estado de la cuenta.";
    redirect(usersUrl({ error: message }));
  }
  revalidateUsers();
  redirect(usersUrl({ saved: suspended ? "suspensión" : "reactivación" }));
}

export async function deleteEmptyUser(formData: FormData) {
  const parsed = adminUserActionSchema.safeParse({ userId: formData.get("userId"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) redirect(usersUrl({ error: "El usuario no es válido." }));
  const { supabase } = await requireAdminAccess();
  const { error: checkError } = await supabase.rpc("admin_assert_user_deletable", { p_user_id: parsed.data.userId });
  if (checkError) {
    const message = checkError.message.includes("owns content") ? "No se puede eliminar: la cuenta todavía tiene contenido o una organización." : "No se puede eliminar esta cuenta.";
    redirect(usersUrl({ error: message }));
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(parsed.data.userId);
  if (error) redirect(usersUrl({ error: "Supabase Auth no pudo eliminar la cuenta." }));
  revalidateUsers();
  redirect(usersUrl({ deleted: parsed.data.userId }));
}

