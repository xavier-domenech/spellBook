import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers3, Plus } from "lucide-react";
import { z } from "zod";
import { DeckLibraryGrid, LibraryPagination } from "@/components/deck-library-grid";
import { deckFormatSchema, firstParam, pageNumberSchema } from "@/features/decks/formats";
import { loadArchetypes, loadLibrary } from "@/features/decks/library";
import { loadFormat } from "@/features/formats/data";
import { hasSupabaseEnv } from "@/lib/env";

type Props = { params: Promise<{ format: string }>; searchParams: Promise<{ page?: string | string[] }> };

export default async function FormatPage({ params, searchParams }: Props) {
  const { format: rawFormat } = await params;
  // Preserve links from the former /decks/:uuid viewer.
  if (z.string().uuid().safeParse(rawFormat).success) redirect(`/deck/${rawFormat}`);
  const parsed = deckFormatSchema.safeParse(rawFormat);
  if (!parsed.success) notFound();
  const formatInfo = await loadFormat(parsed.data, { includeArchived: true });
  if (!formatInfo) notFound();
  const format = formatInfo.slug;
  const page = pageNumberSchema.parse(firstParam((await searchParams).page));
  const configured = hasSupabaseEnv();
  const [groups, recent] = configured ? await Promise.all([loadArchetypes(format, page), loadLibrary(format)]) : [null, null];

  return (
    <main className="page-shell deck-page">
      <Link className="deck-back-link" href="/decks"><ArrowLeft size={15} /> Todos los formatos</Link>
      <header className="deck-section-header">
        <div><p className="eyebrow">Decklists · {formatInfo.rules_summary}</p><h1 className="page-title">{formatInfo.name}</h1><p>{formatInfo.description}</p></div>
        {formatInfo.is_active ? <Link className="button" href={`/decks/new?format=${format}`}><Plus size={17} /> Crear decklist</Link> : <span className="beta-pill">Formato archivado</span>}
      </header>
      {!configured && <p className="setup-notice">La biblioteca estará disponible al configurar la conexión de datos.</p>}
      <section className="deck-browser" aria-labelledby="archetypes-heading">
        <div className="deck-browser-toolbar"><div><h2 id="archetypes-heading">Arquetipos de {formatInfo.name}</h2><p>Listas afines, agrupadas por su composición.</p></div><Link className="deck-text-link" href={`/decks/${format}/lists`}>Todas las listas <ArrowRight size={15} /></Link></div>
        {groups?.error && <p className="form-message" role="alert">No se pudieron cargar los arquetipos. Vuelve a intentarlo.</p>}
        <div className="archetype-grid">
          {groups?.archetypes.map((group) => (
            <Link className="archetype-card" href={`/decks/${format}/archetypes/${group.slug}`} key={group.id}>
              <Layers3 size={23} /><h3>{group.name}</h3><p>{group.deck_count} {group.deck_count === 1 ? "lista" : "listas"}</p>
              <strong>Ver listas <ArrowRight size={15} /></strong>
            </Link>
          ))}
        </div>
        {groups && !groups.error && !groups.archetypes.length && <div className="empty-state"><Layers3 size={30} /><h2>Todavía no hay arquetipos aquí</h2><p>Las listas completas se agruparán al publicarse. Los borradores siguen disponibles en todas las listas.</p></div>}
        {groups && !groups.error && <LibraryPagination page={page} count={groups.count} href={`/decks/${format}`} />}
      </section>
      <section className="deck-browser library-section" aria-labelledby="recent-heading">
        <div className="deck-browser-toolbar"><h2 id="recent-heading">Listas recientes</h2><Link className="deck-text-link" href={`/decks/${format}/lists?classification=unclassified`}>Sin clasificar <ArrowRight size={15} /></Link></div>
        {recent?.error && <p className="form-message" role="alert">No se pudieron cargar las listas.</p>}
        {recent && <DeckLibraryGrid decks={recent.decks.slice(0, 6)} />}
        {recent && !recent.error && !recent.decks.length && <p className="microcopy">Aún no se han compartido listas de este formato.</p>}
      </section>
    </main>
  );
}
