import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, LogOut, Megaphone, MessageSquareText, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { OrganizationHeader } from "@/components/organization-header";
import { cancelOrganizationRequest, joinOrganization, leaveOrganization, requestOrganizationAccess } from "@/features/organizations/actions";
import { canAdministerOrganization, loadOrganizationAnnouncements, loadOrganizationContext } from "@/features/organizations/data";

type OrganizationPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function OrganizationPage({ params, searchParams }: OrganizationPageProps) {
  const { slug } = await params;
  const { error, saved } = await searchParams;
  const organization = await loadOrganizationContext(slug);
  if (!organization) notFound();
  const announcements = await loadOrganizationAnnouncements(organization.id, 3);
  const canAdmin = canAdministerOrganization(organization.viewerRole);

  return (
    <main className="page-shell organization-page">
      <OrganizationHeader active="overview" organization={organization} />
      {error && <div className="form-message" role="alert">{error}</div>}
      {saved === "created" && <div className="organization-success"><CheckCircle2 size={17} /> Organización creada. Ya puedes invitar a la comunidad.</div>}
      {saved === "requested" && <div className="organization-success"><CheckCircle2 size={17} /> Solicitud enviada a los administradores.</div>}

      <div className="organization-overview-grid">
        <section className="organization-panel">
          <div className="organization-section-heading"><div><p className="eyebrow"><Megaphone size={13} /> Tablón oficial</p><h2>Últimos anuncios</h2></div><Link href={`/organizations/${slug}/announcements`}>Ver todos <ArrowRight size={15} /></Link></div>
          <div className="organization-announcement-list compact">
            {announcements.map((announcement) => <article key={announcement.id}><h3>{announcement.title}</h3><p>{announcement.body}</p><small>{new Date(announcement.published_at).toLocaleDateString("es-ES")} · {announcement.author?.display_name ?? "Usuario eliminado"}</small></article>)}
            {announcements.length === 0 && <div className="empty-state"><Megaphone size={27} /><h2>Sin anuncios todavía</h2><p>Las novedades oficiales aparecerán aquí.</p></div>}
          </div>
        </section>

        <aside className="organization-panel organization-membership-panel">
          <h2>Participa</h2>
          {organization.viewerRole ? (
            <>
              <span className="organization-membership-status"><CheckCircle2 size={18} /> Ya formas parte</span>
              <Link className="button" href={`/organizations/${slug}/forum`}><MessageSquareText size={17} /> Entrar al foro</Link>
              {canAdmin && <Link className="button button-secondary" href={`/organizations/${slug}/members`}>Gestionar miembros</Link>}
              {organization.viewerRole !== "owner" && <form action={leaveOrganization}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={slug} /><button className="organization-text-button" type="submit"><LogOut size={15} /> Abandonar organización</button></form>}
            </>
          ) : organization.pendingRequest ? (
            <>
              <span className="organization-membership-status pending"><Clock3 size={18} /> Solicitud pendiente</span>
              <p>Los administradores revisarán tu petición antes de darte acceso.</p>
              <form action={cancelOrganizationRequest}><input name="requestId" type="hidden" value={organization.pendingRequest.id} /><input name="slug" type="hidden" value={slug} /><button className="button button-secondary" type="submit">Cancelar solicitud</button></form>
            </>
          ) : organization.viewerId && organization.access === "public" ? (
            <><p>La incorporación es inmediata. Al unirte podrás crear temas y responder en el foro.</p><form action={joinOrganization}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={slug} /><button className="button" type="submit"><UserPlus size={17} /> Unirme</button></form></>
          ) : organization.viewerId ? (
            <form action={requestOrganizationAccess}>
              <input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={slug} />
              <p><LockKeyhole size={15} /> Esta organización requiere aprobación.</p>
              <div className="field"><label htmlFor="request-message">Mensaje para los administradores</label><textarea className="textarea textarea-short" id="request-message" maxLength={500} name="message" placeholder="Cuéntales brevemente por qué quieres entrar." /></div>
              <button className="button" type="submit">Solicitar acceso</button>
            </form>
          ) : (
            <><p>Inicia sesión para unirte o solicitar acceso.</p><Link className="button" href="/auth">Iniciar sesión</Link></>
          )}
          {organization.formats.length > 0 && <div className="format-pills">{organization.formats.map((format) => <span key={format}>{format}</span>)}</div>}
        </aside>
      </div>
    </main>
  );
}
