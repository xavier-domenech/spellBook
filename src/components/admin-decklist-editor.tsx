"use client";

import { CheckCircle2, Layers3, LoaderCircle, Plus, WandSparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createDeckAsAdmin, createDeckVersionAsAdmin } from "@/app/admin/decklists/actions";
import type { DeckOwnerOption } from "@/features/admin/decklists";
import { validateDeckSize } from "@/features/decks/validation";
import type { MagicFormat } from "@/features/formats/types";

type PreviewCard = {
  quantity: number;
  zone: string;
  scryfallId: string;
  oracleId: string | null;
  canonicalName: string;
  imageSmall: string | null;
  imageNormal: string | null;
};

type Preview = {
  cards: PreviewCard[];
  invalidLines: string[];
  suggestedTitle: string | null;
  unresolved: string[];
};

type Props = {
  formats: MagicFormat[];
  owners: DeckOwnerOption[];
} & ({ mode: "create" } | { mode: "version"; deckId: string; title: string; format: string });

const sample = `Deck
60 Forest`;

export function AdminDecklistEditor(props: Props) {
  const [format, setFormat] = useState(props.mode === "version" ? props.format : props.formats[0]?.slug ?? "standard");
  const [title, setTitle] = useState(props.mode === "version" ? props.title : "");
  const [deckList, setDeckList] = useState(sample);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedFormat = props.formats.find((candidate) => candidate.slug === format) ?? null;
  const size = preview && selectedFormat ? validateDeckSize(selectedFormat, preview.cards) : null;
  const canSave = Boolean(preview && size?.valid && preview.invalidLines.length === 0 && preview.unresolved.length === 0);

  async function previewDeck(event: FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/decks/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckList }),
      });
      const payload = await response.json() as Preview & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo procesar la lista.");
      setPreview(payload);
      if (props.mode === "create" && payload.suggestedTitle) setTitle(payload.suggestedTitle);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la lista.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={props.mode === "create" ? createDeckAsAdmin : createDeckVersionAsAdmin} className="admin-deck-editor">
      {props.mode === "version" && <input name="deckId" type="hidden" value={props.deckId} />}
      <input name="cards" type="hidden" value={preview ? JSON.stringify(preview.cards) : ""} />
      {props.mode === "create" && (
        <>
          <div className="field"><label htmlFor="admin-new-deck-title">Título</label><input className="input" id="admin-new-deck-title" maxLength={100} name="title" onChange={(event) => setTitle(event.target.value)} required value={title} /></div>
          <div className="field"><label htmlFor="admin-new-deck-owner">Propietario</label><select className="select" id="admin-new-deck-owner" name="ownerId" required>{props.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name} · @{owner.handle}</option>)}</select></div>
          <div className="field"><label htmlFor="admin-new-deck-format">Formato</label><select className="select" id="admin-new-deck-format" name="format" onChange={(event) => { setFormat(event.target.value); setPreview(null); }} value={format}>{props.formats.map((candidate) => <option key={candidate.slug} value={candidate.slug}>{candidate.name}</option>)}</select></div>
          <div className="field"><label htmlFor="admin-new-deck-visibility">Visibilidad</label><select className="select" defaultValue="public" id="admin-new-deck-visibility" name="visibility"><option value="public">Pública</option><option value="unlisted">No listada</option><option value="private">Privada</option></select></div>
          <div className="field admin-deck-editor-wide"><label htmlFor="admin-new-deck-description">Descripción</label><textarea className="textarea textarea-short" id="admin-new-deck-description" maxLength={2000} name="description" /></div>
        </>
      )}
      <div className="field admin-deck-editor-wide"><label htmlFor={`admin-deck-list-${props.mode === "version" ? props.deckId : "new"}`}>Lista de cartas</label><textarea className="textarea" id={`admin-deck-list-${props.mode === "version" ? props.deckId : "new"}`} onChange={(event) => { setDeckList(event.target.value); setPreview(null); }} value={deckList} /></div>
      <div className="field admin-deck-editor-wide"><label htmlFor={`admin-deck-note-${props.mode === "version" ? props.deckId : "new"}`}>Nota de versión</label><input className="input" id={`admin-deck-note-${props.mode === "version" ? props.deckId : "new"}`} maxLength={500} name="note" placeholder={props.mode === "create" ? "Versión inicial" : "Describe los cambios"} /></div>
      {error && <p className="form-message admin-deck-editor-wide" role="alert">{error}</p>}
      {preview && (
        <div className={`admin-deck-preview admin-deck-editor-wide ${canSave ? "valid" : "invalid"}`} aria-live="polite">
          {canSave ? <CheckCircle2 size={17} /> : <Layers3 size={17} />}
          <span>{size?.current ?? 0} cartas · {canSave ? "lista válida" : size?.message ?? "revisa la lista"}</span>
          {preview.unresolved.length > 0 && <small>Sin resolver: {preview.unresolved.join(", ")}</small>}
          {preview.invalidLines.length > 0 && <small>Líneas inválidas: {preview.invalidLines.join(" · ")}</small>}
        </div>
      )}
      <div className="form-actions admin-deck-editor-wide">
        <button className="button button-secondary button-small" disabled={loading} onClick={previewDeck} type="button">{loading ? <LoaderCircle className="spin" size={15} /> : <WandSparkles size={15} />} {loading ? "Resolviendo…" : "Previsualizar"}</button>
        <button className="button button-small" disabled={!canSave || !title.trim()} type="submit"><Plus size={15} /> {props.mode === "create" ? "Crear decklist" : "Publicar versión"}</button>
      </div>
    </form>
  );
}
