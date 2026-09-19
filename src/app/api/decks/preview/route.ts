import { NextResponse } from "next/server";
import { z } from "zod";
import { parseDeckList } from "@/features/decks/parser";

const requestSchema = z.object({
  deckList: z.string().min(1).max(20_000),
});

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  type_line: string;
  mana_cost?: string;
  image_uris?: { small?: string; normal?: string };
  card_faces?: Array<{
    name?: string;
    image_uris?: { small?: string; normal?: string };
    mana_cost?: string;
  }>;
  color_identity: string[];
  legalities: Record<string, string>;
};

type CollectionResponse = {
  data: ScryfallCard[];
  not_found?: Array<{ name?: string }>;
};

async function fetchCollection(names: string[]) {
  const cards: ScryfallCard[] = [];
  const notFound: string[] = [];

  for (let index = 0; index < names.length; index += 75) {
    const batch = names.slice(index, index + 75);
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: {
        Accept: "application/json;q=0.9,*/*;q=0.8",
        "Content-Type": "application/json",
        "User-Agent": process.env.SCRYFALL_USER_AGENT ?? "magicSocial/0.1 (development)",
      },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Scryfall respondió con ${response.status}.`);
    const payload = (await response.json()) as CollectionResponse;
    cards.push(...payload.data);
    notFound.push(...(payload.not_found ?? []).flatMap((entry) => entry.name ? [entry.name] : []));
  }

  return { cards, notFound };
}

async function fetchFuzzyMatches(names: string[]) {
  const matches = new Map<string, ScryfallCard>();

  // Exact collection lookup is preferred. Fuzzy fallback is intentionally
  // capped so a malformed import cannot fan out into hundreds of requests.
  for (const [index, name] of names.slice(0, 20).entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 75));
    const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`, {
      headers: {
        Accept: "application/json;q=0.9,*/*;q=0.8",
        "User-Agent": process.env.SCRYFALL_USER_AGENT ?? "magicSocial/0.1 (development)",
      },
      cache: "no-store",
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Scryfall respondió con ${response.status}.`);
    matches.set(name.toLocaleLowerCase("en-US"), await response.json() as ScryfallCard);
  }

  return matches;
}

export async function POST(request: Request) {
  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "La lista no es válida." }, { status: 400 });
  }

  const parsedDeck = parseDeckList(parsedBody.data.deckList);
  if (parsedDeck.cards.length === 0) {
    return NextResponse.json(
      { error: "No encontramos líneas con el formato «cantidad + nombre»." },
      { status: 400 },
    );
  }

  try {
    const uniqueNames = [...new Set(parsedDeck.cards.map((card) => card.name))];
    const { cards, notFound } = await fetchCollection(uniqueNames);
    const fuzzyMatches = await fetchFuzzyMatches(notFound);
    const cardsByName = new Map<string, ScryfallCard>();

    for (const card of [...cards, ...fuzzyMatches.values()]) {
      cardsByName.set(card.name.toLocaleLowerCase("en-US"), card);
      if (card.printed_name) cardsByName.set(card.printed_name.toLocaleLowerCase("en-US"), card);
      for (const face of card.card_faces ?? []) {
        if (face.name) cardsByName.set(face.name.toLocaleLowerCase("en-US"), card);
      }
    }
    for (const [requestedName, card] of fuzzyMatches) cardsByName.set(requestedName, card);

    const resolved = parsedDeck.cards.flatMap((entry) => {
      const card = cardsByName.get(entry.name.toLocaleLowerCase("en-US"));
      if (!card) return [];
      const firstFace = card.card_faces?.[0];
      return [{
        ...entry,
        scryfallId: card.id,
        oracleId: card.oracle_id ?? null,
        canonicalName: card.name,
        typeLine: card.type_line,
        manaCost: card.mana_cost ?? firstFace?.mana_cost ?? null,
        imageSmall: card.image_uris?.small ?? firstFace?.image_uris?.small ?? null,
        imageNormal: card.image_uris?.normal ?? firstFace?.image_uris?.normal ?? null,
        colorIdentity: card.color_identity,
        legalities: card.legalities,
      }];
    });

    const resolvedNames = new Set(resolved.map((card) => card.name.toLocaleLowerCase("en-US")));
    const unresolved = [...new Set(
      parsedDeck.cards.filter((card) => !resolvedNames.has(card.name.toLocaleLowerCase("en-US"))).map((card) => card.name),
    )];

    return NextResponse.json({
      cards: resolved,
      invalidLines: parsedDeck.invalidLines,
      suggestedTitle: parsedDeck.suggestedTitle,
      unresolved,
      totalCards: resolved.reduce((total, card) => total + card.quantity, 0),
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "No se pudo consultar Scryfall." },
      { status: 502 },
    );
  }
}
