"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatActionSchema, formatFormSchema } from "@/features/admin/formats-schema";

function formatsUrl(values: { saved?: string; created?: string; deleted?: string; error?: string }) {
  const params = new URLSearchParams();
  if (values.saved) params.set("saved", values.saved);
  if (values.created) params.set("created", values.created);
  if (values.deleted) params.set("deleted", values.deleted);
  if (values.error) params.set("error", values.error);
  const query = params.toString();
  return `/admin/formats${query ? `?${query}` : ""}`;
}

function parseFormatForm(formData: FormData) {
  return formatFormSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    rulesSummary: formData.get("rulesSummary") ?? "",
    mainboardMin: formData.get("mainboardMin"),
    mainboardMax: formData.get("mainboardMax"),
    commanderMin: formData.get("commanderMin"),
    commanderMax: formData.get("commanderMax"),
    totalMin: formData.get("totalMin"),
    totalMax: formData.get("totalMax"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive") === "on",
  });
}

function formatMutation(parsed: ReturnType<typeof formatFormSchema.parse>) {
  return {
    name: parsed.name,
    description: parsed.description,
    rules_summary: parsed.rulesSummary,
    mainboard_min: parsed.mainboardMin,
    mainboard_max: parsed.mainboardMax,
    commander_min: parsed.commanderMin,
    commander_max: parsed.commanderMax,
    total_min: parsed.totalMin,
    total_max: parsed.totalMax,
    sort_order: parsed.sortOrder,
    is_active: parsed.isActive,
  };
}

function revalidateFormats(slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/formats");
  revalidatePath("/decks");
  revalidatePath("/users");
  revalidatePath("/settings/profile");
  revalidatePath("/organizations");
  if (slug) revalidatePath(`/decks/${slug}`, "layout");
}

export async function createFormat(formData: FormData) {
  const parsed = parseFormatForm(formData);
  if (!parsed.success) {
    redirect(formatsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos del formato." }));
  }
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.from("formats").insert({ slug: parsed.data.slug, ...formatMutation(parsed.data) });
  if (error) {
    const message = error.code === "23505" ? "Ya existe un formato con ese slug." : "No se pudo crear el formato.";
    redirect(formatsUrl({ error: message }));
  }
  revalidateFormats(parsed.data.slug);
  redirect(formatsUrl({ created: parsed.data.slug }));
}

export async function updateFormat(formData: FormData) {
  const parsed = parseFormatForm(formData);
  if (!parsed.success) {
    redirect(formatsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos del formato." }));
  }
  const { supabase } = await requireAdminAccess();
  const { data, error } = await supabase.from("formats").update(formatMutation(parsed.data))
    .eq("slug", parsed.data.slug).select("slug").maybeSingle();
  if (error || !data) redirect(formatsUrl({ error: "No se pudieron guardar los cambios." }));
  revalidateFormats(parsed.data.slug);
  redirect(formatsUrl({ saved: parsed.data.slug }));
}

export async function setFormatActive(formData: FormData) {
  const parsed = formatActionSchema.safeParse({ slug: formData.get("slug"), nextActive: formData.get("nextActive") });
  if (!parsed.success || parsed.data.nextActive === undefined) redirect(formatsUrl({ error: "La acción no es válida." }));
  const { supabase } = await requireAdminAccess();
  const { data, error } = await supabase.from("formats").update({ is_active: parsed.data.nextActive === "true" })
    .eq("slug", parsed.data.slug).select("slug").maybeSingle();
  if (error || !data) redirect(formatsUrl({ error: "No se pudo cambiar el estado del formato." }));
  revalidateFormats(parsed.data.slug);
  redirect(formatsUrl({ saved: parsed.data.slug }));
}

export async function deleteFormat(formData: FormData) {
  const parsed = formatActionSchema.safeParse({ slug: formData.get("slug") });
  if (!parsed.success) redirect(formatsUrl({ error: "El formato no es válido." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("delete_unused_format", { p_slug: parsed.data.slug });
  if (error) {
    const message = error.message.includes("in use") ? "Archiva el formato: todavía tiene contenido relacionado." : "No se pudo eliminar el formato.";
    redirect(formatsUrl({ error: message }));
  }
  revalidateFormats(parsed.data.slug);
  redirect(formatsUrl({ deleted: parsed.data.slug }));
}
