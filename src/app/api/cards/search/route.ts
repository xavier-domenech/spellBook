import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.string().trim().min(2).max(100);

type ScryfallFace = {
  image_uris?: { normal?: string };
  oracle_text?: string;
  mana_cost?: string;
};

type ScryfallCard = {
  id: string;
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  image_uris?: { normal?: string };
  card_faces?: ScryfallFace[];
  artist?: string;
  set_name: string;
  details?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(url.searchParams.get("q"));

  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe al menos dos caracteres." }, { status: 400 });
  }

  const response = await fetch(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(parsed.data)}`,
    {
      headers: {
        Accept: "application/json;q=0.9,*/*;q=0.8",
        "User-Agent": process.env.SCRYFALL_USER_AGENT ?? "magicSocial/0.1 (development)",
      },
      next: { revalidate: 86_400 },
    },
  );

  const card = (await response.json()) as ScryfallCard;

  if (!response.ok) {
    return NextResponse.json(
      { error: response.status === 404 ? "No encontramos esa carta." : card.details ?? "Scryfall no está disponible." },
      { status: response.status === 404 ? 404 : 502 },
    );
  }

  const firstFace = card.card_faces?.[0];
  return NextResponse.json({
    id: card.id,
    name: card.name,
    manaCost: card.mana_cost ?? firstFace?.mana_cost ?? null,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? card.card_faces?.map((face) => face.oracle_text).filter(Boolean).join("\n\n") ?? null,
    image: card.image_uris?.normal ?? firstFace?.image_uris?.normal ?? null,
    artist: card.artist ?? null,
    setName: card.set_name,
  });
}
