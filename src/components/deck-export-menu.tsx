"use client";

import { Check, ChevronDown, Clipboard, Download, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatMagicArenaDeck, type ExportableDeckCard } from "@/features/decks/export";

type DeckExportMenuProps = {
  title: string;
  cards: ExportableDeckCard[];
};

export function DeckExportMenu({ title, cards }: DeckExportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected">("idle");
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const exportText = useMemo(() => formatMagicArenaDeck(title, cards), [cards, title]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dialogOpen]);

  function openArenaExport() {
    setMenuOpen(false);
    setCopyState("idle");
    setDialogOpen(true);
  }

  async function copyDeck() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyState("copied");
    } catch {
      textareaRef.current?.focus();
      textareaRef.current?.select();
      setCopyState("selected");
    }
  }

  return (
    <>
      <div className="deck-export" ref={menuRef}>
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="button button-secondary"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <Download size={17} /> Exportar <ChevronDown aria-hidden="true" size={16} />
        </button>
        {menuOpen && (
          <div aria-label="Formatos de exportación" className="deck-export-dropdown" role="menu">
            <button onClick={openArenaExport} role="menuitem" type="button">
              <span>Magic Arena</span>
              <small>Texto listo para importar</small>
            </button>
          </div>
        )}
      </div>

      {dialogOpen && (
        <div className="deck-export-layer">
          <button aria-label="Cerrar exportación" className="deck-export-backdrop" onClick={() => setDialogOpen(false)} type="button" />
          <section aria-labelledby="deck-export-title" aria-modal="true" className="deck-export-dialog" role="dialog">
            <header className="deck-export-dialog-header">
              <div>
                <p>Exportar a</p>
                <h2 id="deck-export-title">Magic Arena</h2>
              </div>
              <button aria-label="Cerrar" className="deck-drawer-close" onClick={() => setDialogOpen(false)} type="button"><X size={20} /></button>
            </header>
            <div className="deck-export-dialog-content">
              <p>Copia esta lista y pégala en el importador de mazos.</p>
              <label className="sr-only" htmlFor="arena-deck-export">Lista preparada para Magic Arena</label>
              <textarea id="arena-deck-export" readOnly ref={textareaRef} value={exportText} />
              <div className="deck-export-actions">
                <span aria-live="polite">
                  {copyState === "copied" && "Lista copiada al portapapeles."}
                  {copyState === "selected" && "Texto seleccionado: pulsa Ctrl/Cmd+C."}
                </span>
                <button className="button" onClick={copyDeck} type="button">
                  {copyState === "copied" ? <Check size={17} /> : <Clipboard size={17} />}
                  {copyState === "copied" ? "Copiado" : "Copiar lista"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
