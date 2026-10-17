"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/features/admin/auth";
import {
  adminDeckActionSchema,
  createAdminDeckSchema,
  createAdminDeckVersionSchema,
  updateAdminDeckSchema,
  type AdminDeckCard,
} from "@/features/admin/decklists-schema";

function decklistsUrl(values: { created?: string; saved?: string; deleted?: string; error?: string }) {
  const params = new URLSearchParams();
  if (values.created) params.set("created", values.created);
  if (values.saved) params.set("saved", values.saved);
  if (values.deleted) params.set("deleted", values.deleted);
  if (values.error) params.set("error", values.error);
  const query = params.toString();
  return `/admin/decklists${query ? `?${query}` : ""}`;
}

function cardsForDatabase(cards: AdminDeckCard[]) {
  return cards.map((card) => ({
    quantity: card.quantity,
    zone: card.zone,
    scryfall_id: card.scryfallId,
    oracle_id: card.oracleId,
    card_name: card.canonicalName,
    image_small_url: card.imageSmall,
    image_normal_url: card.imageNormal,
  }));
}

function revalidateDecks(deckId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/decklists");
  revalidatePath("/decks", "layout");
  revalidatePath("/feed");
  if (deckId) revalidatePath(`/deck/${deckId}`);
}

export async function createDeckAsAdmin(formData: FormData) {
  const parsed = createAdminDeckSchema.safeParse({
    ownerId: formData.get("ownerId"),
    title: formData.get("title"),
    format: formData.get("format"),
    visibility: formData.get("visibility"),
    description: formData.get("description") ?? "",
    note: formData.get("note") ?? "",
    cards: formData.get("cards"),
  });
  if (!parsed.success) redirect(decklistsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los datos de la decklist." }));
  const { supabase } = await requireAdminAccess();
  const { data, error } = await supabase.rpc("admin_create_deck", {
    p_owner_id: parsed.data.ownerId,
    p_title: parsed.data.title,
    p_format: parsed.data.format,
    p_visibility: parsed.data.visibility,
    p_description: parsed.data.description,
    p_note: parsed.data.note,
    p_cards: cardsForDatabase(parsed.data.cards),
  });
  if (error || !data) redirect(decklistsUrl({ error: "No se pudo crear la decklist. Comprueba el formato y el número de cartas." }));
  revalidateDecks(String(data));
  redirect(decklistsUrl({ created: parsed.data.title }));
}

export async function createDeckVersionAsAdmin(formData: FormData) {
  const parsed = createAdminDeckVersionSchema.safeParse({
    deckId: formData.get("deckId"),
    note: formData.get("note") ?? "",
    cards: formData.get("cards"),
  });
  if (!parsed.success) redirect(decklistsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa la nueva versión." }));
  const { supabase } = await requireAdminAccess();
  const { data, error } = await supabase.rpc("admin_create_deck_version", {
    p_deck_id: parsed.data.deckId,
    p_note: parsed.data.note,
    p_cards: cardsForDatabase(parsed.data.cards),
  });
  if (error) redirect(decklistsUrl({ error: "No se pudo publicar la versión. Comprueba que la decklist esté activa y cumpla el formato." }));
  revalidateDecks(parsed.data.deckId);
  redirect(decklistsUrl({ saved: `Versión ${data}` }));
}

export async function updateDeckAsAdmin(formData: FormData) {
  const parsed = updateAdminDeckSchema.safeParse({
    deckId: formData.get("deckId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) redirect(decklistsUrl({ error: parsed.error.issues[0]?.message ?? "Revisa los metadatos." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_update_deck_metadata", {
    p_deck_id: parsed.data.deckId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_visibility: parsed.data.visibility,
  });
  if (error) redirect(decklistsUrl({ error: "No se pudieron actualizar los metadatos." }));
  revalidateDecks(parsed.data.deckId);
  redirect(decklistsUrl({ saved: parsed.data.title }));
}

export async function transferDeckAsAdmin(formData: FormData) {
  const parsed = adminDeckActionSchema.safeParse({ deckId: formData.get("deckId"), ownerId: formData.get("ownerId") });
  if (!parsed.success || !parsed.data.ownerId) redirect(decklistsUrl({ error: "Selecciona un propietario válido." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_transfer_deck", { p_deck_id: parsed.data.deckId, p_owner_id: parsed.data.ownerId });
  if (error) redirect(decklistsUrl({ error: "No se pudo transferir la decklist." }));
  revalidateDecks(parsed.data.deckId);
  redirect(decklistsUrl({ saved: "Propietario actualizado" }));
}

export async function setDeckModerationAsAdmin(formData: FormData) {
  const parsed = adminDeckActionSchema.safeParse({ deckId: formData.get("deckId"), enabled: formData.get("enabled"), reason: formData.get("reason") ?? "" });
  if (!parsed.success || parsed.data.enabled === undefined || (parsed.data.enabled === "true" && parsed.data.reason.length < 3)) {
    redirect(decklistsUrl({ error: "Indica un motivo de moderación de al menos 3 caracteres." }));
  }
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_set_deck_moderation", {
    p_deck_id: parsed.data.deckId,
    p_hidden: parsed.data.enabled === "true",
    p_reason: parsed.data.reason,
  });
  if (error) redirect(decklistsUrl({ error: "No se pudo cambiar la moderación." }));
  revalidateDecks(parsed.data.deckId);
  redirect(decklistsUrl({ saved: parsed.data.enabled === "true" ? "Decklist ocultada" : "Decklist restaurada" }));
}

export async function setDeckArchivedAsAdmin(formData: FormData) {
  const parsed = adminDeckActionSchema.safeParse({ deckId: formData.get("deckId"), enabled: formData.get("enabled"), reason: formData.get("reason") ?? "" });
  if (!parsed.success || parsed.data.enabled === undefined || (parsed.data.enabled === "true" && parsed.data.reason.length < 3)) {
    redirect(decklistsUrl({ error: "Indica un motivo de archivo de al menos 3 caracteres." }));
  }
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("admin_set_deck_archived", {
    p_deck_id: parsed.data.deckId,
    p_archived: parsed.data.enabled === "true",
    p_reason: parsed.data.reason,
  });
  if (error) redirect(decklistsUrl({ error: "No se pudo cambiar el estado de archivo." }));
  revalidateDecks(parsed.data.deckId);
  redirect(decklistsUrl({ saved: parsed.data.enabled === "true" ? "Decklist archivada" : "Decklist restaurada" }));
}

export async function deleteDeckAsAdmin(formData: FormData) {
  const parsed = adminDeckActionSchema.safeParse({ deckId: formData.get("deckId") });
  if (!parsed.success) redirect(decklistsUrl({ error: "La decklist no es válida." }));
  const { supabase } = await requireAdminAccess();
  const { error } = await supabase.rpc("delete_unreferenced_deck", { p_deck_id: parsed.data.deckId });
  if (error) {
    const message = error.message.includes("references") ? "No se puede eliminar porque alguna versión tiene referencias." : "Archiva la decklist antes de eliminarla.";
    redirect(decklistsUrl({ error: message }));
  }
  revalidateDecks(parsed.data.deckId);
  redirect(decklistsUrl({ deleted: parsed.data.deckId }));
}
