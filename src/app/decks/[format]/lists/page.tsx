import Link from "next/link";
import { notFound } from "next/navigation";
import { DeckLibraryGrid, LibraryPagination } from "@/components/deck-library-grid";
import { deckFormatSchema, firstParam, pageNumberSchema } from "@/features/decks/formats";
import { loadLibrary } from "@/features/decks/library";
import { loadFormat } from "@/features/formats/data";
import { hasSupabaseEnv } from "@/lib/env";

type Props = { params: Promise<{ format: string }>; searchParams: Promise<{ page?: string | string[]; classification?: string | string[] }> };

export default async function FormatListsPage({ params, searchParams }: Props) {
  const parsed = deckFormatSchema.safeParse((await params).format);
  if (!parsed.success) notFound();
  const formatInfo = await loadFormat(parsed.data, { includeArchived: true });
  if (!formatInfo) notFound();
  const format = formatInfo.slug;
  const query = await searchParams;
  const page = pageNumberSchema.parse(firstParam(query.page));
  const unclassified = firstParam(query.classification) === "unclassified";
  const result = hasSupabaseEnv() ? await loadLibrary(format, { page, unclassified }) : null;
  const path = `/decks/${format}/lists`;

  return (
    <main className="page-shell deck-page">
      <Link className="deck-back-link" href={`/decks/${format}`}>← Volver a {formatInfo.name}</Link>
      <header className="deck-intro"><div><p className="eyebrow">{formatInfo.name}</p><h1 className="page-title">{unclassified ? "Listas sin clasificar" : "Todas las decklists"}</h1><p>{result?.count ?? 0} listas públicas</p></div></header>
      <nav className="deck-section-nav" aria-label="Filtrar clasificación">
        <Link className={!unclassified ? "active" : ""} href={path}>Todas</Link>
        <Link className={unclassified ? "active" : ""} href={`${path}?classification=unclassified`}>Sin clasificar</Link>
      </nav>
      {!result && <p className="setup-notice">La biblioteca estará disponible al configurar la conexión de datos.</p>}
      {result?.error && <p className="form-message" role="alert">No se pudieron cargar las listas.</p>}
      {result && <DeckLibraryGrid decks={result.decks} />}
      {result && !result.error && !result.decks.length && <div className="empty-state"><h2>No hay listas aquí todavía</h2><p>Prueba la vista de todas las listas o crea una nueva decklist.</p></div>}
      {result && !result.error && <LibraryPagination page={page} count={result.count} href={`${path}${unclassified ? "?classification=unclassified" : ""}`} />}
    </main>
  );
}
