import type { Metadata } from "next";
import Link from "next/link";
import { Building2, LockKeyhole, MapPin, Plus, Search, Users } from "lucide-react";
import { loadOrganizations, organizationKindLabels } from "@/features/organizations/data";
import { organizationAccessSchema, organizationKindSchema, organizationSearchSchema } from "@/features/organizations/schemas";
import { hasSupabaseEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Organizaciones", description: "Ligas, equipos y comunidades de Magic." };

type OrganizationsPageProps = {
  searchParams: Promise<{ q?: string | string[]; kind?: string | string[]; access?: string | string[]; error?: string }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const params = await searchParams;
  const parsedQuery = organizationSearchSchema.safeParse(first(params.q) ?? "");
  const parsedKind = organizationKindSchema.safeParse(first(params.kind));
  const parsedAccess = organizationAccessSchema.safeParse(first(params.access));
  const { organizations, viewerId, error } = await loadOrganizations({
    query: parsedQuery.success ? parsedQuery.data : undefined,
    kind: parsedKind.success ? parsedKind.data : undefined,
    access: parsedAccess.success ? parsedAccess.data : undefined,
  });

  return (
    <main className="page-shell organizations-page">
      <header className="organizations-heading">
        <div><p className="eyebrow"><Building2 size={14} /> Comunidad organizada</p><h1 className="page-title">Organizaciones</h1><p>Encuentra ligas, equipos, clubes y comunidades donde jugar, conversar y compartir anuncios.</p></div>
        <Link className="button" href={viewerId ? "/organizations/new" : "/auth"}><Plus size={17} /> Crear organización</Link>
      </header>

      {!hasSupabaseEnv() && <div className="setup-notice">Configura Supabase para consultar las organizaciones.</div>}
      {(params.error || error) && <div className="form-message" role="alert">{params.error ?? error}</div>}

      <form action="/organizations" className="organization-filters" method="get" role="search">
        <label className="organization-search"><Search size={18} /><span className="sr-only">Buscar organizaciones</span><input defaultValue={parsedQuery.success ? parsedQuery.data : ""} maxLength={80} name="q" placeholder="Buscar una liga, equipo o comunidad" /></label>
        <select aria-label="Tipo" className="select" defaultValue={parsedKind.success ? parsedKind.data : ""} name="kind">
          <option value="">Todos los tipos</option>
          {organizationKindSchema.options.map((kind) => <option key={kind} value={kind}>{organizationKindLabels[kind]}</option>)}
        </select>
        <select aria-label="Acceso" className="select" defaultValue={parsedAccess.success ? parsedAccess.data : ""} name="access">
          <option value="">Cualquier acceso</option><option value="public">Públicas</option><option value="private">Privadas</option>
        </select>
        <button className="button button-small" type="submit">Filtrar</button>
      </form>

      <section aria-label="Directorio de organizaciones" className="organization-grid">
        {organizations.map((organization) => (
          <Link className="organization-card" href={`/organizations/${organization.slug}`} key={organization.id}>
            <div className="organization-card-top"><span className="organization-card-avatar">{organization.name.slice(0, 2).toUpperCase()}</span><span className="organization-access">{organization.access === "private" && <LockKeyhole size={13} />}{organization.access === "public" ? "Pública" : "Privada"}</span></div>
            <small>{organizationKindLabels[organization.kind]}</small>
            <h2>{organization.name}</h2>
            <p>{organization.description || "Sin descripción todavía."}</p>
            <footer>
              <span><Users size={14} /> {organization.members[0]?.count ?? 0}</span>
              {organization.location && <span><MapPin size={14} /> {organization.location}</span>}
            </footer>
          </Link>
        ))}
      </section>
      {hasSupabaseEnv() && organizations.length === 0 && <div className="empty-state"><Building2 size={30} /><h2>No hay organizaciones con esos filtros</h2><p>Prueba otra búsqueda o crea la primera comunidad.</p></div>}
    </main>
  );
}
