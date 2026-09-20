import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DeckExportMenu } from "@/components/deck-export-menu";
import { loadDeckDetail } from "@/features/decks/detail";
import { firstParam } from "@/features/decks/formats";
import { loadFormat } from "@/features/formats/data";
import { hasSupabaseEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Decklist" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string | string[] }> };
const zoneLabels: Record<string, string> = { commander: "Comandante", mainboard: "Mazo principal", sideboard: "Banquillo", maybeboard: "Consideraciones" };

export default async function DeckPage({ params, searchParams }: Props) {
  const id = z.string().uuid().safeParse((await params).id);
  const versionId = z.string().uuid().optional().safeParse(firstParam((await searchParams).version));
  if (!hasSupabaseEnv() || !id.success || !versionId.success) notFound();
  const details = await loadDeckDetail(id.data, versionId.data);
  if (!details) notFound();
  const { deck, cards } = details;
  const format = await loadFormat(deck.format, { includeArchived: true });
  if (!format) notFound();

  return (
    <main className="page-shell deck-page">
      <Link className="deck-back-link" href={`/decks/${format.slug}`}>← Volver a {format.name}</Link>
      <div className="deck-intro">
        <div><p className="eyebrow">{format.name} · {deck.totalCards} cartas · versión {deck.currentVersion}</p><h1 className="page-title">{deck.title}</h1><p>Por {deck.owner?.displayName ?? "Mago"} · @{deck.owner?.handle ?? "sin_handle"}</p>{deck.description && <p>{deck.description}</p>}</div>
        <DeckExportMenu cards={cards.map(({ zone, quantity, name }) => ({ zone, quantity, name }))} title={deck.title} />
      </div>
      <section className="deck-preview">
        <div className="card-list">
          {cards.map((card) => (
            <article className="card-row" key={card.id}>
              {card.imageSmall ? <Image alt="" className="card-thumb" height={204} src={card.imageSmall} width={146} /> : <div className="card-thumb" />}
              <div><strong>{card.name}</strong><span>{zoneLabels[card.zone] ?? card.zone}</span></div><div className="card-qty">×{card.quantity}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
