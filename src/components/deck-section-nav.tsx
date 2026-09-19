import Link from "next/link";
import { Layers3, Plus } from "lucide-react";

type DeckSectionNavProps = {
  active: "browse" | "create";
};

export function DeckSectionNav({ active }: DeckSectionNavProps) {
  return (
    <nav className="deck-section-nav" aria-label="Secciones de decklists">
      <Link aria-current={active === "browse" ? "page" : undefined} className={active === "browse" ? "active" : ""} href="/decks">
        <Layers3 size={17} /> Explorar decklists
      </Link>
      <Link aria-current={active === "create" ? "page" : undefined} className={active === "create" ? "active" : ""} href="/decks/new">
        <Plus size={17} /> Crear decklist
      </Link>
    </nav>
  );
}
