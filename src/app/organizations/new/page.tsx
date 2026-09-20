import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Save } from "lucide-react";
import { redirect } from "next/navigation";
import { loadFormats } from "@/features/formats/data";
import { createOrganization } from "@/features/organizations/actions";
import { organizationKindLabels } from "@/features/organizations/data";
import { organizationKindSchema } from "@/features/organizations/schemas";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear organización" };

export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!hasSupabaseEnv()) redirect("/auth");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const formats = await loadFormats();
  const { error } = await searchParams;

  return (
    <main className="page-shell organization-form-page">
      <section className="form-card organization-form-card">
        <p className="eyebrow"><Building2 size={14} /> Nueva comunidad</p>
        <h1>Crea una organización</h1>
        <p>El creador será propietario y podrá nombrar administradores después.</p>
        {error && <div className="form-message" role="alert">{error}</div>}
        <form action={createOrganization}>
          <div className="organization-form-grid">
            <div className="field"><label htmlFor="name">Nombre</label><input className="input" id="name" maxLength={80} minLength={3} name="name" required /></div>
            <div className="field"><label htmlFor="slug">Identificador URL</label><div className="input-prefix"><span>/</span><input id="slug" maxLength={50} minLength={3} name="slug" pattern="[a-z0-9][a-z0-9-]+" placeholder="lliga-catalana" required /></div></div>
            <div className="field"><label htmlFor="kind">Tipo</label><select className="select" id="kind" name="kind" required>{organizationKindSchema.options.map((kind) => <option key={kind} value={kind}>{organizationKindLabels[kind]}</option>)}</select></div>
            <div className="field"><label htmlFor="access">Acceso</label><select className="select" id="access" name="access"><option value="public">Pública · incorporación inmediata</option><option value="private">Privada · requiere aprobación</option></select></div>
          </div>
          <div className="field"><label htmlFor="description">Descripción</label><textarea className="textarea textarea-short" id="description" maxLength={1000} name="description" placeholder="Explica qué reúne a vuestra comunidad." /></div>
          <div className="organization-form-grid">
            <div className="field"><label htmlFor="location">Ubicación</label><input className="input" id="location" maxLength={120} name="location" placeholder="Barcelona o comunidad online" /></div>
            <div className="field"><label htmlFor="websiteUrl">Sitio web</label><input className="input" id="websiteUrl" maxLength={500} name="websiteUrl" placeholder="https://..." type="url" /></div>
          </div>
          <fieldset className="format-fieldset"><legend>Formatos relacionados</legend><div className="format-options">{formats.map((format) => <label key={format.slug}><input name="formats" type="checkbox" value={format.slug} /><span>{format.name}</span></label>)}</div></fieldset>
          <div className="form-actions"><Link className="button button-secondary" href="/organizations">Cancelar</Link><button className="button" type="submit"><Save size={17} /> Crear organización</button></div>
        </form>
      </section>
    </main>
  );
}
