import Link from "next/link";
import { Archive, ArchiveRestore, Building2, CheckCircle2, ExternalLink, Plus, Save, Search, Trash2, UserRoundPlus } from "lucide-react";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { adminOrganizationListSchema } from "@/features/admin/organizations-schema";
import { loadAdminOrganizations } from "@/features/admin/organizations";
import { firstParam } from "@/features/decks/formats";
import { loadFormats } from "@/features/formats/data";
import { addOrganizationOwner, createOrganizationAsAdmin, deleteEmptyOrganization, setOrganizationArchived, updateOrganizationAsAdmin } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const kinds = { league: "Liga", team: "Equipo", club: "Club", store: "Tienda", community: "Comunidad" } as const;

export default async function AdminOrganizationsPage({ searchParams }: Props) {
  const query = await searchParams;
  const filters = adminOrganizationListSchema.parse({ query: firstParam(query.q), status: firstParam(query.status), access: firstParam(query.access), page: firstParam(query.page) });
  const saved = z.string().max(50).optional().catch(undefined).parse(firstParam(query.saved));
  const created = z.string().max(50).optional().catch(undefined).parse(firstParam(query.created));
  const deleted = z.string().max(50).optional().catch(undefined).parse(firstParam(query.deleted));
  const error = z.string().max(300).optional().catch(undefined).parse(firstParam(query.error));
  const [{ organizations, owners, count, pageSize }, formats] = await Promise.all([loadAdminOrganizations(filters), loadFormats()]);
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.access !== "all") params.set("access", filters.access);
    if (page > 1) params.set("page", String(page));
    const value = params.toString();
    return `/admin/organizations${value ? `?${value}` : ""}`;
  }

  return (
    <section aria-labelledby="admin-organizations-title">
      <div className="admin-section-heading"><div><h2 id="admin-organizations-title">Organizaciones</h2><p>Supervisa propietarios, configuración, actividad y estado desde la plataforma.</p></div><span>{count} organizaciones</span></div>
      {error && <p className="form-message" role="alert">{error}</p>}
      {(saved || created || deleted) && <p className="admin-success" role="status"><CheckCircle2 size={17} /> {created ? `Organización ${created} creada.` : deleted ? `Organización ${deleted} eliminada.` : `Organización ${saved} actualizada.`}</p>}

      <details className="admin-format-create">
        <summary><Plus size={16} /> Crear organización</summary>
        <form action={createOrganizationAsAdmin} className="admin-organization-form admin-organization-create-form">
          <div className="field"><label htmlFor="new-organization-name">Nombre</label><input className="input" id="new-organization-name" maxLength={80} name="name" required /></div>
          <div className="field"><label htmlFor="new-organization-slug">Slug</label><input className="input" id="new-organization-slug" maxLength={50} name="slug" pattern="[a-z0-9][a-z0-9-]{2,49}" required /></div>
          <div className="field"><label htmlFor="new-organization-owner">Propietario</label><select className="select" id="new-organization-owner" name="ownerId" required>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name} · @{owner.handle}</option>)}</select></div>
          <div className="field"><label htmlFor="new-organization-kind">Tipo</label><select className="select" id="new-organization-kind" name="kind">{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><label htmlFor="new-organization-access">Acceso</label><select className="select" id="new-organization-access" name="access"><option value="public">Pública</option><option value="private">Privada</option></select></div>
          <div className="field"><label htmlFor="new-organization-location">Ubicación</label><input className="input" id="new-organization-location" maxLength={120} name="location" /></div>
          <div className="field"><label htmlFor="new-organization-website">Web</label><input className="input" id="new-organization-website" maxLength={500} name="websiteUrl" type="url" /></div>
          <div className="field admin-organization-description"><label htmlFor="new-organization-description">Descripción</label><textarea className="textarea textarea-short" id="new-organization-description" maxLength={1000} name="description" /></div>
          <fieldset className="admin-organization-formats"><legend>Formatos</legend>{formats.map((format) => <label key={format.slug}><input name="formats" type="checkbox" value={format.slug} /> {format.name}</label>)}</fieldset>
          <button className="button" type="submit"><Plus size={16} /> Crear organización</button>
        </form>
      </details>

      <form className="admin-organization-filters">
        <label className="organization-search" htmlFor="admin-organization-search"><Search size={17} /><input defaultValue={filters.query} id="admin-organization-search" name="q" placeholder="Nombre, slug o propietario" /></label>
        <select aria-label="Estado" className="select" defaultValue={filters.status} name="status"><option value="all">Todos los estados</option><option value="active">Activas</option><option value="archived">Archivadas</option></select>
        <select aria-label="Acceso" className="select" defaultValue={filters.access} name="access"><option value="all">Todos los accesos</option><option value="public">Públicas</option><option value="private">Privadas</option></select>
        <button className="button button-secondary" type="submit">Filtrar</button>
      </form>

      <div className="admin-organization-list">
        {organizations.map((organization) => (
          <article className="admin-organization-card" key={organization.id}>
            <header><div><span className="feature-icon"><Building2 size={19} /></span><div><h3>{organization.name}</h3><p><code>{organization.slug}</code> · propietarios @{organization.owner_handles || "sin propietario"}</p></div></div><div className="admin-user-badges"><span className={`admin-status ${organization.archived_at ? "admin-user-status-suspended" : "admin-user-status-active"}`}>{organization.archived_at ? "Archivada" : "Activa"}</span><span className="admin-status admin-user-role">{organization.access === "public" ? "Pública" : "Privada"}</span><Link aria-label={`Abrir ${organization.name}`} href={`/organizations/${organization.slug}`}><ExternalLink size={16} /></Link></div></header>
            <form action={updateOrganizationAsAdmin} className="admin-organization-form">
              <input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={organization.slug} />
              <div className="field"><label htmlFor={`organization-name-${organization.id}`}>Nombre</label><input className="input" defaultValue={organization.name} id={`organization-name-${organization.id}`} maxLength={80} name="name" required /></div>
              <div className="field"><label htmlFor={`organization-kind-${organization.id}`}>Tipo</label><select className="select" defaultValue={organization.kind} id={`organization-kind-${organization.id}`} name="kind">{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="field"><label htmlFor={`organization-access-${organization.id}`}>Acceso</label><select className="select" defaultValue={organization.access} id={`organization-access-${organization.id}`} name="access"><option value="public">Pública</option><option value="private">Privada</option></select></div>
              <div className="field"><label htmlFor={`organization-location-${organization.id}`}>Ubicación</label><input className="input" defaultValue={organization.location ?? ""} id={`organization-location-${organization.id}`} maxLength={120} name="location" /></div>
              <div className="field"><label htmlFor={`organization-website-${organization.id}`}>Web</label><input className="input" defaultValue={organization.website_url ?? ""} id={`organization-website-${organization.id}`} maxLength={500} name="websiteUrl" type="url" /></div>
              <div className="field admin-organization-description"><label htmlFor={`organization-description-${organization.id}`}>Descripción</label><textarea className="textarea textarea-short" defaultValue={organization.description} id={`organization-description-${organization.id}`} maxLength={1000} name="description" /></div>
              <fieldset className="admin-organization-formats"><legend>Formatos</legend>{formats.map((format) => <label key={format.slug}><input defaultChecked={organization.formats.includes(format.slug)} name="formats" type="checkbox" value={format.slug} /> {format.name}</label>)}</fieldset>
              <button className="button button-small" type="submit"><Save size={15} /> Guardar cambios</button>
            </form>
            <footer>
              <div className="admin-format-usage"><span>{organization.member_count} miembros</span><span>{organization.pending_request_count} solicitudes</span><span>{organization.topic_count} temas</span><span>{organization.announcement_count} anuncios</span></div>
              <div className="admin-organization-actions">
                <form action={addOrganizationOwner}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={organization.slug} /><select aria-label={`Nuevo propietario de ${organization.name}`} className="select" name="userId">{owners.map((owner) => <option key={owner.id} value={owner.id}>@{owner.handle}</option>)}</select><button className="button button-secondary button-small" type="submit"><UserRoundPlus size={14} /> Añadir owner</button></form>
                {organization.archived_at ? <form action={setOrganizationArchived}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={organization.slug} /><input name="archived" type="hidden" value="false" /><button className="button button-secondary button-small" type="submit"><ArchiveRestore size={14} /> Restaurar</button></form> : <form action={setOrganizationArchived}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={organization.slug} /><input name="archived" type="hidden" value="true" /><input aria-label={`Motivo para archivar ${organization.name}`} className="input" maxLength={500} minLength={3} name="reason" placeholder="Motivo" required /><button className="button button-secondary button-small" type="submit"><Archive size={14} /> Archivar</button></form>}
                {organization.archived_at && <form action={deleteEmptyOrganization}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={organization.slug} /><ConfirmSubmitButton message={`¿Eliminar definitivamente ${organization.name}? Solo funcionará si no tiene actividad.`}><Trash2 size={14} /> Eliminar vacía</ConfirmSubmitButton></form>}
              </div>
            </footer>
          </article>
        ))}
        {organizations.length === 0 && <div className="empty-state"><Building2 size={28} /><h3>No hay organizaciones con estos filtros</h3></div>}
      </div>
      {pageCount > 1 && <nav aria-label="Paginación de organizaciones" className="pagination"><Link aria-disabled={filters.page <= 1} href={pageHref(Math.max(1, filters.page - 1))}>Anterior</Link><span>Página {filters.page} de {pageCount}</span><Link aria-disabled={filters.page >= pageCount} href={pageHref(Math.min(pageCount, filters.page + 1))}>Siguiente</Link></nav>}
    </section>
  );
}

