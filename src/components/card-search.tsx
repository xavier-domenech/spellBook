"use client";

import Image from "next/image";
import { Search, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

type CardResult = {
  id: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  oracleText: string | null;
  image: string | null;
  artist: string | null;
  setName: string;
};

export function CardSearch() {
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<CardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as CardResult & { error?: string };

      if (!response.ok) throw new Error(payload.error ?? "No se pudo buscar la carta.");
      setCard(payload);
    } catch (cause) {
      setCard(null);
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="search-panel">
      <p className="eyebrow"><Sparkles size={14} /> Visor conectado a Scryfall</p>
      <form className="search-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="card-search">Nombre de la carta</label>
        <input
          className="input"
          id="card-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Prueba con Black Lotus, Atraxa o Relámpago…"
          value={query}
        />
        <button className="button" disabled={loading || query.trim().length < 2} type="submit">
          <Search size={17} /> {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {error && <p className="form-message" role="alert">{error}</p>}
      {card && (
        <article className="card-result">
          {card.image ? (
            <Image alt={card.name} height={680} src={card.image} width={488} />
          ) : (
            <div className="card-thumb" aria-label="Imagen no disponible" />
          )}
          <div>
            <h3>{card.name}</h3>
            <p className="author-handle">{card.manaCost} · {card.typeLine}</p>
            <p className="oracle-text">{card.oracleText ?? "Sin texto Oracle."}</p>
            <p className="microcopy">{card.setName}{card.artist ? ` · Ilustración: ${card.artist}` : ""}</p>
          </div>
        </article>
      )}
    </div>
  );
}
