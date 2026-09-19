import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Layers3, Plus } from "lucide-react";
import { DeckSectionNav } from "@/components/deck-section-nav";
import { deckFormats } from "@/features/decks/validation";
import { deckFormatSchema, firstParam, formatInfo } from "@/features/decks/formats";

export const metadata: Metadata = { title: "Decklists" };

export default async function DecksPage({ searchParams }: { searchParams: Promise<{ format?: string | string[] }> }) {
  const legacyFormat = deckFormatSchema.safeParse(firstParam((await searchParams).format));
  if (legacyFormat.success) redirect(`/decks/${legacyFormat.data}`);

  return (
    <main className="page-shell deck-page">
      <header className="deck-section-header">
        <div><p className="eyebrow">Biblioteca de la comunidad</p><h1 className="page-title">Cada formato, su mesa.</h1><p>Elige un formato para descubrir sus arquetipos y las listas de otros jugadores.</p></div>
        <Link className="button" href="/decks/new"><Plus size={17} /> Crear decklist</Link>
      </header>
      <DeckSectionNav active="browse" />
      <div className="format-directory">
        {deckFormats.map((format) => (
          <Link className={`format-entry format-entry-${format}`} href={`/decks/${format}`} key={format}>
            <span className="feature-icon"><Layers3 size={24} /></span>
            <h2>{formatInfo[format].label}</h2>
            <p>{formatInfo[format].description}</p>
            <small>{formatInfo[format].size}</small>
            <strong>Entrar en {formatInfo[format].label} <ArrowRight size={17} /></strong>
          </Link>
        ))}
      </div>
    </main>
  );
}
