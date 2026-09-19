"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Layers3, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DeckAttachment } from "@/features/social/data";

type DeckDrawerTriggerProps = {
  attachment: DeckAttachment;
};

type DeckDetails = {
  deck: {
    id: string;
    title: string;
    format: string;
    description: string;
    currentVersion: number;
    owner: { handle: string; displayName: string } | null;
    totalCards: number;
  };
  cards: Array<{
    id: number;
    zone: string;
    quantity: number;
    name: string;
    imageSmall: string | null;
  }>;
};

const zoneLabels: Record<string, string> = {
  commander: "Comandante",
  mainboard: "Mazo principal",
  sideboard: "Banquillo",
  maybeboard: "Puede que entren",
};

export function DeckDrawerTrigger({ attachment }: DeckDrawerTriggerProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<DeckDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function showDeck() {
    setOpen(true);
    if (details || loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/decks/${attachment.deckId}?version=${attachment.deckVersionId}`);
      const payload = (await response.json()) as DeckDetails & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el mazo.");
      setDetails(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el mazo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="post-deck" onClick={showDeck} type="button">
        <span className="feature-icon"><Layers3 size={18} /></span>
        <span><small>{attachment.format} · {attachment.totalCards} cartas · v{attachment.version}</small><strong>{attachment.title}</strong></span>
        <span className="post-deck-cta">Ver mazo</span>
      </button>

      {open && (
        <div className="deck-drawer-layer">
          <button aria-label="Cerrar visor del mazo" className="deck-drawer-backdrop" onClick={() => setOpen(false)} type="button" />
          <aside aria-labelledby={`deck-drawer-title-${attachment.deckId}`} aria-modal="true" className="deck-drawer" role="dialog">
            <header className="deck-drawer-header">
              <div>
                <p>{details?.deck.format ?? attachment.format} · {details?.deck.totalCards ?? attachment.totalCards} cartas · v{details?.deck.currentVersion ?? attachment.version}</p>
                <h2 id={`deck-drawer-title-${attachment.deckId}`}>{details?.deck.title ?? attachment.title}</h2>
              </div>
              <button aria-label="Cerrar" className="deck-drawer-close" onClick={() => setOpen(false)} type="button"><X size={20} /></button>
            </header>

            <div className="deck-drawer-content">
              {loading && <div className="deck-drawer-status"><LoaderCircle className="spin" size={26} /><p>Cargando decklist…</p></div>}
              {error && <div className="deck-drawer-status"><p>{error}</p><button className="button button-small" onClick={() => { setDetails(null); void showDeck(); }} type="button">Reintentar</button></div>}
              {details && (
                <>
                  <div className="deck-drawer-summary">
                    <div>
                      <span>Creado por</span>
                      <strong>{details.deck.owner?.displayName ?? "Mago"}</strong>
                      {details.deck.owner && <small>@{details.deck.owner.handle}</small>}
                    </div>
                    <Link className="button button-secondary button-small" href={`/deck/${details.deck.id}?version=${attachment.deckVersionId}`}>Página completa <ArrowUpRight size={15} /></Link>
                  </div>
                  {details.deck.description && <p className="deck-drawer-description">{details.deck.description}</p>}
                  <div className="deck-drawer-cards">
                    {details.cards.map((card, index) => {
                      const previousZone = details.cards[index - 1]?.zone;
                      return (
                        <div className="deck-drawer-card-group" key={card.id}>
                          {card.zone !== previousZone && <h3>{zoneLabels[card.zone] ?? card.zone}</h3>}
                          <article className="deck-drawer-card">
                            {card.imageSmall ? <Image alt={`Carta ${card.name}`} height={204} src={card.imageSmall} width={146} /> : <span className="deck-drawer-card-placeholder"><Layers3 size={20} /></span>}
                            <div><strong>{card.name}</strong><span>{zoneLabels[card.zone] ?? card.zone}</span></div>
                            <b>×{card.quantity}</b>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                  {details.cards.length === 0 && <div className="deck-drawer-status"><p>Esta versión no contiene cartas.</p></div>}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
