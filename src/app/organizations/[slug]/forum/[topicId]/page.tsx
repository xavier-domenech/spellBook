import Link from "next/link";
import { ArrowLeft, LockKeyhole, LockOpen, MessageSquareText, Pin, PinOff, Send } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OrganizationHeader } from "@/components/organization-header";
import { createForumMessage, moderateForumTopic } from "@/features/organizations/actions";
import { canAdministerOrganization, loadOrganizationContext, loadOrganizationTopic } from "@/features/organizations/data";

export default async function OrganizationTopicPage({ params, searchParams }: {
  params: Promise<{ slug: string; topicId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug, topicId } = await params;
  const { error } = await searchParams;
  const organization = await loadOrganizationContext(slug);
  if (!organization) notFound();
  if (organization.access === "private" && !organization.viewerRole) redirect(`/organizations/${slug}`);
  const { topic, messages } = await loadOrganizationTopic(organization.id, topicId);
  if (!topic) notFound();
  const canAdmin = canAdministerOrganization(organization.viewerRole);

  return (
    <main className="page-shell organization-page">
      <OrganizationHeader active="forum" organization={organization} />
      {error && <div className="form-message" role="alert">{error}</div>}
      <Link className="organization-back-link" href={`/organizations/${slug}/forum`}><ArrowLeft size={15} /> Volver al foro</Link>
      <article className={`organization-panel organization-topic-detail ${topic.status === "hidden" ? "hidden" : ""}`}>
        <header><div><div className="organization-badges">{topic.is_pinned && <span><Pin size={12} /> Fijado</span>}{topic.is_locked && <span><LockKeyhole size={12} /> Cerrado</span>}{topic.status === "hidden" && <span>Oculto</span>}</div><h1>{topic.title}</h1><small>Por {topic.author?.display_name ?? "Usuario eliminado"} · {new Date(topic.created_at).toLocaleString("es-ES")}</small></div>
          {canAdmin && <div className="organization-moderation-actions">
            <form action={moderateForumTopic}><input name="topicId" type="hidden" value={topic.id} /><input name="slug" type="hidden" value={slug} /><input name="action" type="hidden" value={topic.is_pinned ? "unpin" : "pin"} /><button className="button button-secondary button-small" type="submit">{topic.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}{topic.is_pinned ? "Desfijar" : "Fijar"}</button></form>
            <form action={moderateForumTopic}><input name="topicId" type="hidden" value={topic.id} /><input name="slug" type="hidden" value={slug} /><input name="action" type="hidden" value={topic.is_locked ? "unlock" : "lock"} /><button className="button button-secondary button-small" type="submit">{topic.is_locked ? <LockOpen size={14} /> : <LockKeyhole size={14} />}{topic.is_locked ? "Abrir" : "Cerrar"}</button></form>
          </div>}
        </header>
        <p className="organization-long-copy">{topic.body}</p>
      </article>

      <section aria-label="Respuestas" className="organization-message-list">
        {messages.map((message) => <article className={`organization-panel organization-message ${message.status === "hidden" ? "hidden" : ""}`} key={message.id}><header><Link href={message.author ? `/u/${message.author.handle}` : "#"}>{message.author?.display_name ?? "Usuario eliminado"}</Link><time>{new Date(message.created_at).toLocaleString("es-ES")}</time></header><p>{message.body}</p></article>)}
      </section>

      {organization.viewerRole && !topic.is_locked ? (
        <form action={createForumMessage} className="organization-panel organization-reply-form">
          <input name="topicId" type="hidden" value={topic.id} /><input name="slug" type="hidden" value={slug} />
          <div className="field"><label htmlFor="reply-body">Responder</label><textarea className="textarea textarea-short" id="reply-body" maxLength={5000} name="body" required /></div>
          <button className="button" type="submit"><Send size={16} /> Publicar respuesta</button>
        </form>
      ) : topic.is_locked ? <div className="organization-panel organization-locked"><LockKeyhole size={20} /> Este tema está cerrado.</div> : <div className="organization-panel organization-locked"><MessageSquareText size={20} /> Únete para responder.</div>}
    </main>
  );
}
