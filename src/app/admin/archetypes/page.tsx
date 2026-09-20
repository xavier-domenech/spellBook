import Link from "next/link";
import { CheckCircle2, ExternalLink, Filter, Shapes } from "lucide-react";
import { z } from "zod";
import { loadAdminArchetypes } from "@/features/admin/archetypes";
import { archetypeStatusSchema } from "@/features/admin/archetypes-schema";
import { deckFormatSchema, firstParam } from "@/features/decks/formats";
import { loadFormats } from "@/features/formats/data";
import { updateArchetype } from "./actions";

type Props = { searchParams: Promise<{ format?: string | string[]; status?: string | string[]; saved?: string | string[]; error?: string | string[] }> };

export default async function AdminArchetypesPage({ searchParams }: Props) {
  const params = await searchParams;
  const requestedFormat = deckFormatSchema.optional().catch(undefined).parse(firstParam(params.format));
  const status = archetypeStatusSchema.optional().catch(undefined).parse(firstParam(params.status));
  const saved = z.string().uuid().optional().catch(undefined).parse(firstParam(params.saved));
  const error = z.string().max(300).optional().catch(undefined).parse(firstParam(params.error));
  const formats = await loadFormats({ includeArchived: true });
  const format = formats.some((candidate) => candidate.slug === requestedFormat) ? requestedFormat : undefined;
  const formatNames = new Map(formats.map((candidate) => [candidate.slug, candidate.name]));
  const { archetypes, count } = await loadAdminArchetypes({ format, status });

  const filterHref = (nextFormat?: string, nextStatus?: string) => {
    const query = new URLSearchParams();
    if (nextFormat) query.set("format", nextFormat);
    if (nextStatus) query.set("status", nextStatus);
    return `/admin/archetypes${query.size ? `?${query}` : ""}`;
  };

  return (
    <section aria-labelledby="admin-archetypes-title">
      <div className="admin-section-heading">
        <div><h2 id="admin-archetypes-title">Arquetipos</h2><p>Edita la información visible sin cambiar la agrupación automática de las listas.</p></div>
        <span>{count} resultados</span>
      </div>

      {error && <p className="form-message" role="alert">{error}</p>}
      {saved && <p className="admin-success" role="status"><CheckCircle2 size={17} /> Cambios guardados correctamente.</p>}

      <div className="admin-filters">
        <span><Filter size={15} /> Formato</span>
        <Link className={!format ? "active" : ""} href={filterHref(undefined, status)}>Todos</Link>
        {formats.map((candidate) => <Link className={format === candidate.slug ? "active" : ""} href={filterHref(candidate.slug, status)} key={candidate.slug}>{candidate.name}</Link>)}
        <span>Estado</span>
        <Link className={!status ? "active" : ""} href={filterHref(format, undefined)}>Todos</Link>
        <Link className={status === "provisional" ? "active" : ""} href={filterHref(format, "provisional")}>Provisionales</Link>
        <Link className={status === "reviewed" ? "active" : ""} href={filterHref(format, "reviewed")}>Revisados</Link>
      </div>

      <div className="admin-archetype-list">
        {archetypes.map((archetype) => (
          <article className={`admin-archetype-card ${saved === archetype.id ? "saved" : ""}`} key={archetype.id}>
            <header>
              <div><span className={`admin-status admin-status-${archetype.status}`}>{archetype.status === "reviewed" ? "Revisado" : "Provisional"}</span><strong>{formatNames.get(archetype.format) ?? archetype.format} · {archetype.deck_count} listas</strong></div>
              <Link href={`/decks/${archetype.format}/archetypes/${archetype.slug}`} target="_blank">Ver público <ExternalLink size={14} /></Link>
            </header>
            <form action={updateArchetype} className="admin-archetype-form">
              <input name="id" type="hidden" value={archetype.id} />
              <input name="filterFormat" type="hidden" value={format ?? ""} />
              <input name="filterStatus" type="hidden" value={status ?? ""} />
              <div className="field"><label htmlFor={`name-${archetype.id}`}>Nombre</label><input className="input" defaultValue={archetype.name} id={`name-${archetype.id}`} maxLength={100} name="name" required /></div>
              <div className="field"><label htmlFor={`slug-${archetype.id}`}>Slug de la URL</label><input className="input" defaultValue={archetype.slug} id={`slug-${archetype.id}`} maxLength={100} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><small>Minúsculas, números y guiones. Debe ser único dentro del formato.</small></div>
              <div className="field admin-description-field"><label htmlFor={`description-${archetype.id}`}>Descripción</label><textarea className="textarea textarea-short" defaultValue={archetype.description} id={`description-${archetype.id}`} maxLength={1000} name="description" placeholder="Explica brevemente el plan del arquetipo." /></div>
              <div className="field"><label htmlFor={`status-${archetype.id}`}>Estado</label><select className="select" defaultValue={archetype.status} id={`status-${archetype.id}`} name="status"><option value="provisional">Provisional</option><option value="reviewed">Revisado</option></select></div>
              <button className="button button-small" type="submit">Guardar cambios</button>
            </form>
          </article>
        ))}
      </div>

      {archetypes.length === 0 && <div className="empty-state"><Shapes size={30} /><h2>No hay arquetipos con estos filtros</h2><p>Cambia el formato o el estado para ampliar los resultados.</p></div>}
    </section>
  );
}
