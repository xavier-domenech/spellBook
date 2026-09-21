import Link from "next/link";
import { Archive, ArchiveRestore, CheckCircle2, ExternalLink, Eye, EyeOff, Layers3, Save, Search, Trash2, UserRoundCog } from "lucide-react";
import { z } from "zod";
import { AdminDecklistEditor } from "@/components/admin-decklist-editor";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { adminDeckListSchema } from "@/features/admin/decklists-schema";
import { loadAdminDecklists } from "@/features/admin/decklists";
import { firstParam } from "@/features/decks/formats";
import { loadFormats } from "@/features/formats/data";
import { deleteDeckAsAdmin, setDeckArchivedAsAdmin, setDeckModerationAsAdmin, transferDeckAsAdmin, updateDeckAsAdmin } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const visibilityLabels = { public: "Pública", unlisted: "No listada", private: "Privada" } as const;

export default async function AdminDecklistsPage({ searchParams }: Props) {
  const query = await searchParams;
  const filters = adminDeckListSchema.parse({ query: firstParam(query.q), format: firstParam(query.format), state: firstParam(query.state), page: firstParam(query.page) });
  const created = z.string().max(100).optional().catch(undefined).parse(firstParam(query.created));
  const saved = z.string().max(100).optional().catch(undefined).parse(firstParam(query.saved));
  const deleted = z.string().max(100).optional().catch(undefined).parse(firstParam(query.deleted));
  const error = z.string().max(300).optional().catch(undefined).parse(firstParam(query.error));
  const [{ decks, owners, count, pageSize }, formats] = await Promise.all([loadAdminDecklists(filters), loadFormats({ includeArchived: true })]);
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.format !== "all") params.set("format", filters.format);
    if (filters.state !== "all") params.set("state", filters.state);
    if (page > 1) params.set("page", String(page));
    const value = params.toString();
    return `/admin/decklists${value ? `?${value}` : ""}`;
  }

  return (
    <section aria-labelledby="admin-decklists-title">
      <div className="admin-section-heading"><div><h2 id="admin-decklists-title">Decklists</h2><p>Crea listas para usuarios, conserva sus versiones y modera su publicación.</p></div><span>{count} decklists</span></div>
      {error && <p className="form-message" role="alert">{error}</p>}
      {(created || saved || deleted) && <p className="admin-success" role="status"><CheckCircle2 size={17} /> {created ? `Decklist ${created} creada.` : deleted ? `Decklist ${deleted} eliminada.` : `${saved} actualizada.`}</p>}

      <details className="admin-format-create admin-deck-create">
        <summary><Layers3 size={16} /> Crear decklist</summary>
        <AdminDecklistEditor formats={formats.filter((format) => format.is_active)} mode="create" owners={owners} />
      </details>

      <form className="admin-deck-filters">
        <label className="organization-search" htmlFor="admin-deck-search"><Search size={17} /><input defaultValue={filters.query} id="admin-deck-search" name="q" placeholder="Título o propietario" /></label>
        <select aria-label="Formato" className="select" defaultValue={filters.format} name="format"><option value="all">Todos los formatos</option>{formats.map((format) => <option key={format.slug} value={format.slug}>{format.name}</option>)}</select>
        <select aria-label="Estado" className="select" defaultValue={filters.state} name="state"><option value="all">Todos los estados</option><option value="active">Visibles</option><option value="hidden">Ocultas</option><option value="archived">Archivadas</option></select>
        <button className="button button-secondary" type="submit">Filtrar</button>
      </form>

      <div className="admin-deck-list">
        {decks.map((deck) => (
          <article className="admin-deck-card" key={deck.id}>
            <header>
              <div><span className="feature-icon"><Layers3 size={19} /></span><div><h3>{deck.title}</h3><p>{deck.format_name} · @{deck.owner_handle} · v{deck.current_version}</p></div></div>
              <div className="admin-user-badges">
                <span className={`admin-status ${deck.archived_at ? "admin-user-status-suspended" : deck.moderation_status === "hidden" ? "admin-user-status-pending" : "admin-user-status-active"}`}>{deck.archived_at ? "Archivada" : deck.moderation_status === "hidden" ? "Oculta" : "Visible"}</span>
                <span className="admin-status admin-user-role">{visibilityLabels[deck.visibility]}</span>
                <Link aria-label={`Abrir ${deck.title}`} href={`/deck/${deck.id}`}><ExternalLink size={16} /></Link>
              </div>
            </header>

            <form action={updateDeckAsAdmin} className="admin-deck-metadata-form">
              <input name="deckId" type="hidden" value={deck.id} />
              <div className="field"><label htmlFor={`deck-title-${deck.id}`}>Título</label><input className="input" defaultValue={deck.title} id={`deck-title-${deck.id}`} maxLength={100} name="title" required /></div>
              <div className="field"><label htmlFor={`deck-visibility-${deck.id}`}>Visibilidad</label><select className="select" defaultValue={deck.visibility} id={`deck-visibility-${deck.id}`} name="visibility"><option value="public">Pública</option><option value="unlisted">No listada</option><option value="private">Privada</option></select></div>
              <div className="field admin-deck-description"><label htmlFor={`deck-description-${deck.id}`}>Descripción</label><textarea className="textarea textarea-short" defaultValue={deck.description} id={`deck-description-${deck.id}`} maxLength={2000} name="description" /></div>
              <button className="button button-small" type="submit"><Save size={15} /> Guardar</button>
            </form>

            {!deck.archived_at && (
              <details className="admin-deck-version">
                <summary>Publicar una nueva versión inmutable</summary>
                <AdminDecklistEditor deckId={deck.id} format={deck.format} formats={formats} mode="version" owners={owners} title={deck.title} />
              </details>
            )}

            <footer>
              <div className="admin-format-usage"><span>{deck.total_cards} cartas</span><span>{deck.version_count} versiones</span><span>{deck.post_count} publicaciones</span></div>
              <div className="admin-deck-actions">
                <form action={transferDeckAsAdmin}><input name="deckId" type="hidden" value={deck.id} /><select aria-label={`Propietario de ${deck.title}`} className="select" defaultValue={deck.owner_id} name="ownerId">{owners.map((owner) => <option key={owner.id} value={owner.id}>@{owner.handle}</option>)}</select><button className="button button-secondary button-small" type="submit"><UserRoundCog size={14} /> Transferir</button></form>
                {deck.moderation_status === "hidden" ? (
                  <form action={setDeckModerationAsAdmin}><input name="deckId" type="hidden" value={deck.id} /><input name="enabled" type="hidden" value="false" /><button className="button button-secondary button-small" type="submit"><Eye size={14} /> Mostrar</button></form>
                ) : (
                  <form action={setDeckModerationAsAdmin}><input name="deckId" type="hidden" value={deck.id} /><input name="enabled" type="hidden" value="true" /><input aria-label={`Motivo para ocultar ${deck.title}`} className="input" maxLength={500} minLength={3} name="reason" placeholder="Motivo" required /><button className="button button-secondary button-small" type="submit"><EyeOff size={14} /> Ocultar</button></form>
                )}
                {deck.archived_at ? (
                  <><form action={setDeckArchivedAsAdmin}><input name="deckId" type="hidden" value={deck.id} /><input name="enabled" type="hidden" value="false" /><button className="button button-secondary button-small" type="submit"><ArchiveRestore size={14} /> Restaurar</button></form><form action={deleteDeckAsAdmin}><input name="deckId" type="hidden" value={deck.id} /><ConfirmSubmitButton message={`¿Eliminar definitivamente ${deck.title}? Solo funcionará si no tiene referencias.`}><Trash2 size={14} /> Eliminar</ConfirmSubmitButton></form></>
                ) : (
                  <form action={setDeckArchivedAsAdmin}><input name="deckId" type="hidden" value={deck.id} /><input name="enabled" type="hidden" value="true" /><input aria-label={`Motivo para archivar ${deck.title}`} className="input" maxLength={500} minLength={3} name="reason" placeholder="Motivo" required /><button className="button button-secondary button-small" type="submit"><Archive size={14} /> Archivar</button></form>
                )}
              </div>
            </footer>
          </article>
        ))}
        {decks.length === 0 && <div className="empty-state"><Layers3 size={28} /><h3>No hay decklists con estos filtros</h3></div>}
      </div>
      {pageCount > 1 && <nav aria-label="Paginación de decklists" className="pagination"><Link aria-disabled={filters.page <= 1} href={pageHref(Math.max(1, filters.page - 1))}>Anterior</Link><span>Página {filters.page} de {pageCount}</span><Link aria-disabled={filters.page >= pageCount} href={pageHref(Math.min(pageCount, filters.page + 1))}>Siguiente</Link></nav>}
    </section>
  );
}
