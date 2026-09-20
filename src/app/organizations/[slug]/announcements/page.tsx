import { Megaphone, Pin, Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OrganizationHeader } from "@/components/organization-header";
import { createAnnouncement, deleteAnnouncement } from "@/features/organizations/actions";
import { canAdministerOrganization, loadOrganizationAnnouncements, loadOrganizationContext } from "@/features/organizations/data";

export default async function OrganizationAnnouncementsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug } = await params;
  const { error, saved } = await searchParams;
  const organization = await loadOrganizationContext(slug);
  if (!organization) notFound();
  if (organization.access === "private" && !organization.viewerRole) redirect(`/organizations/${slug}`);
  const announcements = await loadOrganizationAnnouncements(organization.id);
  const canAdmin = canAdministerOrganization(organization.viewerRole);

  return (
    <main className="page-shell organization-page">
      <OrganizationHeader active="announcements" organization={organization} />
      {error && <div className="form-message" role="alert">{error}</div>}
      {saved && <div className="organization-success">Anuncio publicado correctamente.</div>}
      <div className="organization-content-grid">
        <section className="organization-panel">
          <div className="organization-section-heading"><div><p className="eyebrow"><Megaphone size={13} /> Comunicación oficial</p><h2>Tablón de anuncios</h2></div><span>{announcements.length} publicaciones</span></div>
          <div className="organization-announcement-list">
            {announcements.map((announcement) => (
              <article key={announcement.id}>
                <header><div>{announcement.is_pinned && <span className="organization-pinned"><Pin size={13} /> Fijado</span>}<h3>{announcement.title}</h3></div>{canAdmin && <form action={deleteAnnouncement}><input name="announcementId" type="hidden" value={announcement.id} /><input name="slug" type="hidden" value={slug} /><button aria-label="Retirar anuncio" className="icon-button" type="submit"><Trash2 size={16} /></button></form>}</header>
                <p>{announcement.body}</p>
                <small>{new Date(announcement.published_at).toLocaleString("es-ES")} · {announcement.author?.display_name ?? "Usuario eliminado"}</small>
              </article>
            ))}
            {announcements.length === 0 && <div className="empty-state"><Megaphone size={30} /><h2>Todavía no hay anuncios</h2><p>Las comunicaciones oficiales aparecerán aquí.</p></div>}
          </div>
        </section>
        {canAdmin && <aside className="organization-panel organization-create-panel"><h2><Megaphone size={19} /> Publicar anuncio</h2><form action={createAnnouncement}><input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={slug} /><div className="field"><label htmlFor="announcement-title">Título</label><input className="input" id="announcement-title" maxLength={120} minLength={3} name="title" required /></div><div className="field"><label htmlFor="announcement-body">Contenido</label><textarea className="textarea" id="announcement-body" maxLength={5000} name="body" required /></div><label className="organization-checkbox"><input name="isPinned" type="checkbox" /> Fijar en la parte superior</label><button className="button" type="submit">Publicar</button></form></aside>}
      </div>
    </main>
  );
}
