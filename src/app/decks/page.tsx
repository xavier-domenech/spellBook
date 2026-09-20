import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Layers3, Plus } from "lucide-react";
import { DeckSectionNav } from "@/components/deck-section-nav";
import { deckFormatSchema, firstParam } from "@/features/decks/formats";
import { loadFormats } from "@/features/formats/data";

export const metadata: Metadata = { title: "Decklists" };

export default async function DecksPage({ searchParams }: { searchParams: Promise<{ format?: string | string[] }> }) {
  const [formats, query] = await Promise.all([loadFormats(), searchParams]);
  const legacyFormat = deckFormatSchema.safeParse(firstParam(query.format));
  if (legacyFormat.success && formats.some((format) => format.slug === legacyFormat.data)) redirect(`/decks/${legacyFormat.data}`);

  return (
    <main className="page-shell deck-page">
      <header className="deck-section-header">
        <div><p className="eyebrow">Biblioteca de la comunidad</p><h1 className="page-title">Cada formato, su mesa.</h1><p>Elige un formato para descubrir sus arquetipos y las listas de otros jugadores.</p></div>
        <Link className="button" href="/decks/new"><Plus size={17} /> Crear decklist</Link>
      </header>
      <DeckSectionNav active="browse" />
      <div className="format-directory">
        {formats.map((format) => (
          <Link className={`format-entry format-entry-${format.slug}`} href={`/decks/${format.slug}`} key={format.slug}>
            <span className="feature-icon"><Layers3 size={24} /></span>
            <h2>{format.name}</h2>
            <p>{format.description}</p>
            <small>{format.rules_summary}</small>
            <strong>Entrar en {format.name} <ArrowRight size={17} /></strong>
          </Link>
        ))}
      </div>
    </main>
  );
}
