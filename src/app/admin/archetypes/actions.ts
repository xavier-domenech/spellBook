"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/features/admin/auth";
import { updateArchetypeSchema } from "@/features/admin/archetypes-schema";

function adminArchetypesUrl(values: { format?: string; status?: string; saved?: string; error?: string }) {
  const params = new URLSearchParams();
  if (values.format) params.set("format", values.format);
  if (values.status) params.set("status", values.status);
  if (values.saved) params.set("saved", values.saved);
  if (values.error) params.set("error", values.error);
  const query = params.toString();
  return `/admin/archetypes${query ? `?${query}` : ""}`;
}

export async function updateArchetype(formData: FormData) {
  const parsed = updateArchetypeSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    status: formData.get("status"),
    filterFormat: formData.get("filterFormat") || undefined,
    filterStatus: formData.get("filterStatus") || undefined,
  });

  if (!parsed.success) {
    redirect(adminArchetypesUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos del arquetipo." }));
  }

  const { supabase } = await requireAdminAccess();
  const { data: current, error: currentError } = await supabase.from("archetypes")
    .select("format, slug").eq("id", parsed.data.id).maybeSingle();
  if (currentError || !current) {
    redirect(adminArchetypesUrl({ error: "El arquetipo ya no está disponible." }));
  }

  const { data: updated, error } = await supabase.from("archetypes").update({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    status: parsed.data.status,
  }).eq("id", parsed.data.id).select("id").maybeSingle();

  if (error || !updated) {
    const message = error?.code === "23505"
      ? "Ya existe un arquetipo con ese slug dentro del formato."
      : "No se pudieron guardar los cambios.";
    redirect(adminArchetypesUrl({ format: parsed.data.filterFormat, status: parsed.data.filterStatus, error: message }));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/archetypes");
  revalidatePath(`/decks/${current.format}`);
  revalidatePath(`/decks/${current.format}/archetypes/${current.slug}`);
  revalidatePath(`/decks/${current.format}/archetypes/${parsed.data.slug}`);
  redirect(adminArchetypesUrl({ format: parsed.data.filterFormat, status: parsed.data.filterStatus, saved: parsed.data.id }));
}
