import { createClient } from "@/lib/supabase/server";

export async function loadDeckDetail(id: string, versionId?: string) {
  const supabase = await createClient();
  const { data: deck, error } = await supabase.from("decks")
    .select("id, title, format, description, current_version, profiles!decks_owner_id_fkey(handle, display_name)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo consultar el mazo.");
  if (!deck) return null;

  let query = supabase.from("deck_versions").select("id, version").eq("deck_id", id);
  query = versionId ? query.eq("id", versionId) : query.eq("version", deck.current_version);
  const { data: version, error: versionError } = await query.maybeSingle();
  if (versionError) throw new Error("No se pudo consultar la versión.");
  if (!version) return null;
  // Paginate rather than silently truncating old/imported versions at the API row cap.
  const cards: Array<{ id: number; zone: string; quantity: number; name: string; imageSmall: string | null }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error: cardsError } = await supabase.from("deck_cards")
      .select("id, zone, quantity, card_name, image_small_url").eq("deck_version_id", version.id)
      .order("zone").order("card_name").order("id").range(offset, offset + 499);
    if (cardsError) throw new Error("No se pudieron cargar las cartas.");
    cards.push(...(data ?? []).map((card) => ({ id: card.id, zone: card.zone, quantity: card.quantity, name: card.card_name, imageSmall: card.image_small_url })));
    if (!data || data.length < 500) break;
  }
  const owner = Array.isArray(deck.profiles) ? deck.profiles[0] : deck.profiles;
  return {
    deck: {
      id: deck.id as string, title: deck.title as string, format: deck.format as string,
      description: deck.description as string, currentVersion: version.version as number,
      versionId: version.id as string,
      owner: owner ? { handle: owner.handle as string, displayName: owner.display_name as string } : null,
      totalCards: cards.reduce((sum, card) => sum + card.quantity, 0),
    },
    cards,
  };
}
