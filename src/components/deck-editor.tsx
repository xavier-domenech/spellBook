"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Layers3, LoaderCircle, Save, WandSparkles } from "lucide-react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { type DeckFormat, validateDeckSize } from "@/features/decks/validation";
import type { MagicFormat } from "@/features/formats/types";

type PreviewCard = {
  quantity: number;
  name: string;
  canonicalName: string;
  zone: string;
  scryfallId: string;
  oracleId: string | null;
  typeLine: string;
  imageSmall: string | null;
  imageNormal: string | null;
};

type Preview = {
  cards: PreviewCard[];
  totalCards: number;
  invalidLines: string[];
  suggestedTitle: string | null;
  unresolved: string[];
};

const example = `About
Name Atraxa, voces del jardín

Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Swords to Plowshares
1 Cultivate

Sideboard
1 Negate`;

const previewZones = [
  { key: "commander", label: "Comandante" },
  { key: "mainboard", label: "Mazo principal" },
  { key: "sideboard", label: "Banquillo" },
  { key: "maybeboard", label: "Consideraciones" },
] as const;

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function DeckEditor({ formats, initialFormat }: { formats: MagicFormat[]; initialFormat: DeckFormat }) {
  const router = useRouter();
  const [title, setTitle] = useState("Atraxa, voces del jardín");
  const [format, setFormat] = useState<DeckFormat>(initialFormat);
  const [visibility, setVisibility] = useState("public");
  const [deckList, setDeckList] = useState(example);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const ready = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const selectedFormat = formats.find((candidate) => candidate.slug === format) ?? null;
  const sizeValidation = preview && selectedFormat ? validateDeckSize(selectedFormat, preview.cards) : null;

  async function previewDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/decks/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckList }),
      });
      const payload = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo procesar el mazo.");
      setPreview(payload);
      if (payload.suggestedTitle) setTitle(payload.suggestedTitle);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDeck() {
    if (!preview || !sizeValidation?.valid || preview.unresolved.length || preview.invalidLines.length) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, format, visibility, cards: preview.cards }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (response.status === 401) {
        router.push("/auth");
        return;
      }
      if (!response.ok || !payload.id) throw new Error(payload.error ?? "No se pudo guardar el mazo.");
      router.push(`/deck/${payload.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
      setSaving(false);
    }
  }

  return (
    <form className="deck-workspace" onSubmit={previewDeck}>
      <section className="deck-editor">
        <div className="editor-grid">
          <div className="field">
            <label htmlFor="deck-title">Nombre del mazo</label>
            <input className="input" disabled={!ready || saving} id="deck-title" maxLength={100} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </div>
          <div className="field">
            <label htmlFor="deck-format">Formato</label>
            <select className="select" disabled={!ready || loading || saving} id="deck-format" onChange={(event) => setFormat(event.target.value as DeckFormat)} value={format}>
              {formats.map((candidate) => <option key={candidate.slug} value={candidate.slug}>{candidate.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="deck-visibility">Visibilidad</label>
          <select className="select" disabled={!ready || saving} id="deck-visibility" onChange={(event) => setVisibility(event.target.value)} value={visibility}>
            <option value="public">Público</option>
            <option value="unlisted">No listado</option>
            <option value="private">Privado</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="deck-list">Lista de cartas</label>
          <textarea className="textarea" disabled={!ready || loading || saving} id="deck-list" onChange={(event) => { setDeckList(event.target.value); setPreview(null); }} value={deckList} />
          <p className="deck-import-help">Admite el formato de Arena con <code>About</code>, <code>Name</code>, <code>Deck</code> y <code>Sideboard</code>. El banquillo se guarda, pero no cuenta para el mínimo del mazo principal.</p>
        </div>
        {error && <p className="form-message" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="button" disabled={!ready || loading || saving} type="submit">
            {loading ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}
            {loading ? "Resolviendo…" : "Previsualizar"}
          </button>
          <button className="button button-secondary" disabled={!ready || !preview || !sizeValidation?.valid || preview.unresolved.length > 0 || preview.invalidLines.length > 0 || loading || saving || !title.trim()} onClick={saveDeck} type="button">
            {saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </section>

      <section className="deck-preview" aria-live="polite">
        <div className="preview-heading"><h2>Vista del mazo</h2>{sizeValidation && <span className={`beta-pill ${sizeValidation.valid ? "deck-size-valid" : "deck-size-invalid"}`}>{sizeValidation.current}/{sizeValidation.required} cartas</span>}</div>
        {!preview ? (
          <div className="empty-state"><Layers3 size={30} /><h2>Tu lista aparecerá aquí</h2><p>Procesaremos los nombres y traeremos cada impresión desde Scryfall.</p></div>
        ) : (
          <>
            {sizeValidation && !sizeValidation.valid && <p className="deck-size-message" role="status">{sizeValidation.message}</p>}
            <div className="preview-zones">
              {previewZones.map((zone) => {
                const cards = preview.cards.filter((card) => card.zone === zone.key);
                if (!cards.length) return null;
                const count = cards.reduce((sum, card) => sum + card.quantity, 0);
                return (
                  <section className="preview-zone" key={zone.key}>
                    <div className="preview-zone-heading"><h3>{zone.label}</h3><span>{count} {count === 1 ? "carta" : "cartas"}</span></div>
                    <div className="card-list">
                      {cards.map((card) => (
                        <article className="card-row" key={`${card.zone}-${card.scryfallId}`}>
                          {card.imageSmall ? <Image alt="" className="card-thumb" height={204} src={card.imageSmall} width={146} /> : <div className="card-thumb" />}
                          <div><strong>{card.canonicalName}</strong><span>{card.typeLine}</span></div>
                          <div className="card-qty">×{card.quantity}</div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
            {(preview.unresolved.length > 0 || preview.invalidLines.length > 0) && (
              <div className="unresolved">
                {preview.unresolved.length > 0 && <p><strong>Sin resolver:</strong> {preview.unresolved.join(", ")}</p>}
                {preview.invalidLines.length > 0 && <p><strong>Líneas inválidas:</strong> {preview.invalidLines.join(" · ")}</p>}
              </div>
            )}
          </>
        )}
      </section>
    </form>
  );
}
