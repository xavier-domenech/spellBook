import Link from "next/link";
import { LockKeyhole, MessageSquarePlus, MessageSquareText, Pin, Reply } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OrganizationHeader } from "@/components/organization-header";
import { createForumTopic } from "@/features/organizations/actions";
import { loadOrganizationContext, loadOrganizationTopics } from "@/features/organizations/data";

export default async function OrganizationForumPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const organization = await loadOrganizationContext(slug);
  if (!organization) notFound();
  if (organization.access === "private" && !organization.viewerRole) redirect(`/organizations/${slug}?error=${encodeURIComponent("Necesitas ser miembro para acceder al foro.")}`);
  const topics = await loadOrganizationTopics(organization.id);

  return (
    <main className="page-shell organization-page">
      <OrganizationHeader active="forum" organization={organization} />
      {error && <div className="form-message" role="alert">{error}</div>}
      <div className="organization-content-grid">
        <section className="organization-panel">
          <div className="organization-section-heading"><div><p className="eyebrow"><MessageSquareText size={13} /> Conversación</p><h2>Foro general</h2></div><span>{topics.length} temas</span></div>
          <div className="organization-topic-list">
            {topics.map((topic) => (
              <Link className={`organization-topic ${topic.status === "hidden" ? "hidden" : ""}`} href={`/organizations/${slug}/forum/${topic.id}`} key={topic.id}>
                <span className="organization-topic-icon">{topic.is_locked ? <LockKeyhole size={19} /> : <MessageSquareText size={19} />}</span>
                <span><strong>{topic.is_pinned && <Pin size={13} />} {topic.title}</strong><small>Por {topic.author?.display_name ?? "Usuario eliminado"} · {new Date(topic.last_activity_at).toLocaleDateString("es-ES")}</small></span>
                <span className="organization-topic-count"><Reply size={14} /> {topic.messages[0]?.count ?? 0}</span>
              </Link>
            ))}
            {topics.length === 0 && <div className="empty-state"><MessageSquareText size={30} /><h2>Todavía no hay temas</h2><p>Los miembros pueden iniciar la primera conversación.</p></div>}
          </div>
        </section>

        <aside className="organization-panel organization-create-panel">
          <h2><MessageSquarePlus size={19} /> Nuevo tema</h2>
          {organization.viewerRole ? (
            <form action={createForumTopic}>
              <input name="organizationId" type="hidden" value={organization.id} /><input name="slug" type="hidden" value={slug} />
              <div className="field"><label htmlFor="topic-title">Título</label><input className="input" id="topic-title" maxLength={120} minLength={3} name="title" required /></div>
              <div className="field"><label htmlFor="topic-body">Mensaje</label><textarea className="textarea" id="topic-body" maxLength={5000} name="body" required /></div>
              <button className="button" type="submit">Publicar tema</button>
            </form>
          ) : <><p>Únete a la organización para iniciar conversaciones y responder.</p><Link className="button" href={`/organizations/${slug}`}>Ver incorporación</Link></>}
        </aside>
      </div>
    </main>
  );
}
