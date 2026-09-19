import type { Metadata } from "next";
import { DeckEditor } from "@/components/deck-editor";
import { DeckSectionNav } from "@/components/deck-section-nav";
import { deckFormatSchema, firstParam } from "@/features/decks/formats";

export const metadata: Metadata = { title: "Nueva decklist" };

export default async function NewDeckPage({ searchParams }: { searchParams: Promise<{ format?: string | string[] }> }) {
  const format = deckFormatSchema.safeParse(firstParam((await searchParams).format));
  return (
    <main className="page-shell deck-page">
      <div className="deck-intro">
        <div><p className="eyebrow">Constructor de decklists</p><h1 className="page-title">Convierte una lista en un mazo.</h1><p>Pega un export de Arena, Moxfield o una lista sencilla. El servidor resolverá las cartas sin que tengas que subir imágenes.</p></div>
      </div>
      <DeckSectionNav active="create" />
      <DeckEditor initialFormat={format.success ? format.data : "commander"} key={format.data ?? "commander"} />
    </main>
  );
}
