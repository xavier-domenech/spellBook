import Link from "next/link";
import { Save, Settings } from "lucide-react";
import { notFound } from "next/navigation";
import { OrganizationHeader } from "@/components/organization-header";
import { loadFormats } from "@/features/formats/data";
import { updateOrganization } from "@/features/organizations/actions";
import { canAdministerOrganization, loadOrganizationContext, organizationKindLabels } from "@/features/organizations/data";
import { organizationKindSchema } from "@/features/organizations/schemas";

export default async function OrganizationSettingsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug } = await params;
  const { error, saved } = await searchParams;
  const [organization, formats] = await Promise.all([loadOrganizationContext(slug), loadFormats()]);
  if (!organization || !canAdministerOrganization(organization.viewerRole)) notFound();

  return (
    <main className="page-shell organization-page">
      <OrganizationHeader active="settings" organization={organization} />
      <section className="form-card organization-settings-card">
        <p className="eyebrow"><Settings size={14} /> Administración</p><h2>Configura la organización</h2><p>Los cambios de acceso se aplican inmediatamente. Los miembros actuales se conservan.</p>
        {error && <div className="form-message" role="alert">{error}</div>}
        {saved && <div className="organization-success">Cambios guardados correctamente.</div>}
        <form action={updateOrganization}>
          <input name="organizationId" type="hidden" value={organization.id} /><input name="currentSlug" type="hidden" value={slug} />
          <div className="organization-form-grid"><div className="field"><label htmlFor="name">Nombre</label><input className="input" defaultValue={organization.name} id="name" maxLength={80} minLength={3} name="name" required /></div><div className="field"><label htmlFor="slug">Identificador URL</label><div className="input-prefix"><span>/</span><input defaultValue={organization.slug} id="slug" maxLength={50} minLength={3} name="slug" pattern="[a-z0-9][a-z0-9-]+" required /></div></div><div className="field"><label htmlFor="kind">Tipo</label><select className="select" defaultValue={organization.kind} id="kind" name="kind">{organizationKindSchema.options.map((kind) => <option key={kind} value={kind}>{organizationKindLabels[kind]}</option>)}</select></div><div className="field"><label htmlFor="access">Acceso</label><select className="select" defaultValue={organization.access} id="access" name="access"><option value="public">Pública</option><option value="private">Privada</option></select></div></div>
          <div className="field"><label htmlFor="description">Descripción</label><textarea className="textarea textarea-short" defaultValue={organization.description} id="description" maxLength={1000} name="description" /></div>
          <div className="organization-form-grid"><div className="field"><label htmlFor="location">Ubicación</label><input className="input" defaultValue={organization.location ?? ""} id="location" maxLength={120} name="location" /></div><div className="field"><label htmlFor="websiteUrl">Sitio web</label><input className="input" defaultValue={organization.website_url ?? ""} id="websiteUrl" maxLength={500} name="websiteUrl" type="url" /></div></div>
          <fieldset className="format-fieldset"><legend>Formatos relacionados</legend><div className="format-options">{formats.map((format) => <label key={format.slug}><input defaultChecked={organization.formats.includes(format.slug)} name="formats" type="checkbox" value={format.slug} /><span>{format.name}</span></label>)}</div></fieldset>
          <div className="form-actions"><Link className="button button-secondary" href={`/organizations/${slug}`}>Cancelar</Link><button className="button" type="submit"><Save size={17} /> Guardar cambios</button></div>
        </form>
      </section>
    </main>
  );
}
