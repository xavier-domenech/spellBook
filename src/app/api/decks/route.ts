import { NextResponse } from "next/server";
import { z } from "zod";
import { validateDeckSize } from "@/features/decks/validation";
import { formatSlugSchema } from "@/features/formats/schemas";
import type { FormatRules } from "@/features/formats/types";
import { createClient } from "@/lib/supabase/server";

const imageUrl = z.string().url().refine(
  (value) => new URL(value).hostname === "cards.scryfall.io",
  "La imagen debe proceder de Scryfall.",
).nullable();

const deckSchema = z.object({
  title: z.string().trim().min(1).max(100),
  format: formatSlugSchema,
  visibility: z.enum(["public", "unlisted", "private"]),
  cards: z.array(z.object({
    zone: z.enum(["commander", "mainboard", "sideboard", "maybeboard"]),
    quantity: z.number().int().min(1).max(100),
    oracleId: z.string().uuid().nullable(),
    scryfallId: z.string().uuid(),
    canonicalName: z.string().min(1).max(200),
    imageSmall: imageUrl,
    imageNormal: imageUrl,
  })).min(1).max(500),
});

export async function POST(request: Request) {
  const body = deckSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Los datos del mazo no son válidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: formatData, error: formatError } = await supabase.from("formats")
    .select("name, mainboard_min, mainboard_max, commander_min, commander_max, total_min, total_max")
    .eq("slug", body.data.format).eq("is_active", true).maybeSingle();
  if (formatError) return NextResponse.json({ error: "No se pudo validar el formato." }, { status: 500 });
  if (!formatData) return NextResponse.json({ error: "El formato no existe o está archivado." }, { status: 400 });

  const sizeValidation = validateDeckSize(formatData as FormatRules, body.data.cards);
  if (!sizeValidation.valid) {
    return NextResponse.json({ error: sizeValidation.message }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar el mazo." }, { status: 401 });

  const { data, error } = await supabase.rpc("create_deck", {
    p_title: body.data.title,
    p_format: body.data.format,
    p_visibility: body.data.visibility,
    p_cards: body.data.cards.map((card) => ({
      zone: card.zone,
      quantity: card.quantity,
      oracle_id: card.oracleId,
      scryfall_id: card.scryfallId,
      card_name: card.canonicalName,
      image_small_url: card.imageSmall,
      image_normal_url: card.imageNormal,
    })),
  });

  if (error) {
    console.error("create_deck RPC failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const message = process.env.NODE_ENV === "development"
      ? `No se pudo guardar el mazo: ${error.message}`
      : "No se pudo guardar el mazo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
