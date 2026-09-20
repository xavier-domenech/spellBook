import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Layers3 } from "lucide-react";
import type { LibraryDeck } from "@/features/decks/library";

export function DeckLibraryGrid({ decks }: { decks: LibraryDeck[] }) {
  return (
    <div className="deck-grid">
      {decks.map((deck) => (
        <Link className="deck-library-card" href={`/deck/${deck.id}`} key={deck.id}>
          <div className="deck-library-cover">
            {deck.cover_url ? <Image alt="" height={204} src={deck.cover_url} width={146} /> : <Layers3 aria-hidden="true" size={36} />}
            <span>{deck.format_name}</span>
          </div>
          <div className="deck-library-body">
            <div>
              <p className="deck-library-owner">{deck.display_name} · @{deck.handle}</p>
              <h3>{deck.title}</h3>
              <p className="deck-library-description">{deck.description || "Sin descripción todavía."}</p>
              <p className="microcopy">{deck.archetype_name ? `Arquetipo: ${deck.archetype_name}` : "Sin clasificar"}</p>
            </div>
            <footer><span>{deck.total_cards} cartas · v{deck.current_version}</span><strong>Ver mazo <ArrowRight size={14} /></strong></footer>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function LibraryPagination({ page, count, href }: { page: number; count: number; href: string }) {
  const pages = Math.max(1, Math.ceil(count / 24));
  const separator = href.includes("?") ? "&" : "?";
  if (pages === 1 && page === 1) return null;
  return (
    <nav className="library-pagination" aria-label="Páginas de resultados">
      {page > 1 && <Link className="button button-secondary button-small" href={`${href}${separator}page=${page - 1}`}>Anterior</Link>}
      <span>Página {page} · {count} resultados</span>
      {page < pages && <Link className="button button-secondary button-small" href={`${href}${separator}page=${page + 1}`}>Siguiente</Link>}
    </nav>
  );
}
