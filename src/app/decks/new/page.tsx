import type { Metadata } from "next";
import { DeckEditor } from "@/components/deck-editor";
import { DeckSectionNav } from "@/components/deck-section-nav";
import { deckFormatSchema, firstParam } from "@/features/decks/formats";
import { loadFormats } from "@/features/formats/data";

export const metadata: Metadata = { title: "Nueva decklist" };

export default async function NewDeckPage({ searchParams }: { searchParams: Promise<{ format?: string | string[] }> }) {
  const [formats, query] = await Promise.all([loadFormats(), searchParams]);
  const format = deckFormatSchema.safeParse(firstParam(query.format));
  const initialFormat = formats.some((candidate) => candidate.slug === format.data) ? format.data! : formats[0]?.slug;
  return (
    <main className="page-shell deck-page">
      <div className="deck-intro">
        <div><p className="eyebrow">Constructor de decklists</p><h1 className="page-title">Convierte una lista en un mazo.</h1><p>Pega un export de Arena, Moxfield o una lista sencilla. El servidor resolverá las cartas sin que tengas que subir imágenes.</p></div>
      </div>
      <DeckSectionNav active="create" />
      {initialFormat ? <DeckEditor formats={formats} initialFormat={initialFormat} key={initialFormat} /> : <p className="setup-notice">No hay formatos activos. Un administrador debe activar al menos uno.</p>}
    </main>
  );
}
