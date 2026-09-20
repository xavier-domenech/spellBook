"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/features/admin/auth";
import { adminOrganizationActionSchema, createAdminOrganizationSchema, updateAdminOrganizationSchema } from "@/features/admin/organizations-schema";

function organizationsUrl(values: { saved?: string; created?: string; deleted?: string; error?: string }) {
  const params = new URLSearchParams();
  if (values.saved) params.set("saved", values.saved);
  if (values.created) params.set("created", values.created);
  if (values.deleted) params.set("deleted", values.deleted);
  if (values.error) params.set("error", values.error);
  const query = params.toString();
  return `/admin/organizations${query ? `?${query}` : ""}`;
}

function organizationValues(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    kind: formData.get("kind"),
    access: formData.get("access"),
    description: formData.get("description") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    location: formData.get("location") ?? "",
    formats: formData.getAll("formats"),
  };
}

function revalidateOrganizations(slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/organizations");
  if (slug) revalidatePath(`/organizations/${slug}`, "layout");
}

export async function createOrganizationAsAdmin(formData: FormData) {
  const parsed = createAdminOrganizationSchema.safeParse({ ...organizationValues(formData), ownerId: formData.get("ownerId") });
  if (!parsed.success) redirect(organizationsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos de la organización." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_create_organization", {
    p_owner_id: parsed.data.ownerId, p_name: parsed.data.name, p_slug: parsed.data.slug,
    p_kind: parsed.data.kind, p_access: parsed.data.access, p_description: parsed.data.description,
    p_website_url: parsed.data.websiteUrl || null, p_location: parsed.data.location || null, p_formats: parsed.data.formats,
  });
  if (error) {
    const message = error.code === "23505" ? "Ya existe una organización con ese slug." : "No se pudo crear la organización.";
    redirect(organizationsUrl({ error: message }));
  }
  revalidateOrganizations(parsed.data.slug);
  redirect(organizationsUrl({ created: parsed.data.slug }));
}

export async function updateOrganizationAsAdmin(formData: FormData) {
  const parsed = updateAdminOrganizationSchema.safeParse({ ...organizationValues(formData), organizationId: formData.get("organizationId") });
  const slug = String(formData.get("slug") ?? "");
  if (!parsed.success) redirect(organizationsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos de la organización." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_update_organization", {
    p_organization_id: parsed.data.organizationId, p_name: parsed.data.name, p_kind: parsed.data.kind,
    p_access: parsed.data.access, p_description: parsed.data.description, p_website_url: parsed.data.websiteUrl || null,
    p_location: parsed.data.location || null, p_formats: parsed.data.formats,
  });
  if (error) redirect(organizationsUrl({ error: "No se pudo actualizar la organización." }));
  revalidateOrganizations(slug);
  redirect(organizationsUrl({ saved: slug }));
}

export async function addOrganizationOwner(formData: FormData) {
  const parsed = adminOrganizationActionSchema.safeParse({
    organizationId: formData.get("organizationId"), slug: formData.get("slug"), userId: formData.get("userId"),
  });
  if (!parsed.success || !parsed.data.userId) redirect(organizationsUrl({ error: "Selecciona un propietario válido." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_add_organization_owner", {
    p_organization_id: parsed.data.organizationId, p_user_id: parsed.data.userId,
  });
  if (error) redirect(organizationsUrl({ error: "No se pudo añadir el propietario." }));
  revalidateOrganizations(parsed.data.slug);
  redirect(organizationsUrl({ saved: parsed.data.slug }));
}

export async function setOrganizationArchived(formData: FormData) {
  const parsed = adminOrganizationActionSchema.safeParse({
    organizationId: formData.get("organizationId"), slug: formData.get("slug"),
    reason: formData.get("reason") ?? "", archived: formData.get("archived"),
  });
  if (!parsed.success || parsed.data.archived === undefined || (parsed.data.archived === "true" && parsed.data.reason.length < 3)) {
    redirect(organizationsUrl({ error: "Indica un motivo de archivo de al menos 3 caracteres." }));
  }
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_set_organization_archived", {
    p_organization_id: parsed.data.organizationId,
    p_archived: parsed.data.archived === "true",
    p_reason: parsed.data.reason,
  });
  if (error) redirect(organizationsUrl({ error: "No se pudo cambiar el estado de la organización." }));
  revalidateOrganizations(parsed.data.slug);
  redirect(organizationsUrl({ saved: parsed.data.slug }));
}

export async function deleteEmptyOrganization(formData: FormData) {
  const parsed = adminOrganizationActionSchema.safeParse({ organizationId: formData.get("organizationId"), slug: formData.get("slug") });
  if (!parsed.success) redirect(organizationsUrl({ error: "La organización no es válida." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("delete_empty_organization", { p_organization_id: parsed.data.organizationId });
  if (error) {
    const message = error.message.includes("activity") ? "No se puede eliminar: conserva actividad o más miembros." : "Archiva la organización antes de eliminarla.";
    redirect(organizationsUrl({ error: message }));
  }
  revalidateOrganizations(parsed.data.slug);
  redirect(organizationsUrl({ deleted: parsed.data.slug }));
}

