import Link from "next/link";
import { Check, Clock3, ShieldCheck, UserMinus, Users, X } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OrganizationHeader } from "@/components/organization-header";
import { changeOrganizationMemberRole, removeOrganizationMember, reviewOrganizationRequest } from "@/features/organizations/actions";
import { canAdministerOrganization, loadOrganizationContext, loadOrganizationMembers, loadOrganizationRequests, organizationRoleLabels } from "@/features/organizations/data";

export default async function OrganizationMembersPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug } = await params;
  const { error, saved } = await searchParams;
  const organization = await loadOrganizationContext(slug);
  if (!organization) notFound();
  if (organization.access === "private" && !organization.viewerRole) redirect(`/organizations/${slug}`);
  const canAdmin = canAdministerOrganization(organization.viewerRole);
  const [members, requests] = await Promise.all([
    loadOrganizationMembers(organization.id),
    canAdmin ? loadOrganizationRequests(organization.id) : Promise.resolve([]),
  ]);
  const roleOrder = { owner: 0, admin: 1, member: 2 } as const;
  members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.profile.display_name.localeCompare(b.profile.display_name));

  return (
    <main className="page-shell organization-page">
      <OrganizationHeader active="members" organization={organization} />
      {error && <div className="form-message" role="alert">{error}</div>}
      {saved && <div className="organization-success">Los cambios de membresía se han guardado.</div>}

      {canAdmin && <section className="organization-panel organization-requests">
        <div className="organization-section-heading"><div><p className="eyebrow"><Clock3 size={13} /> Acceso privado</p><h2>Solicitudes pendientes</h2></div><span>{requests.length}</span></div>
        {requests.map((request) => <article key={request.id}><div><Link href={`/u/${request.requester.handle}`}><strong>{request.requester.display_name}</strong><small>@{request.requester.handle}</small></Link><p>{request.message || "Sin mensaje."}</p></div><div className="organization-request-actions"><form action={reviewOrganizationRequest}><input name="requestId" type="hidden" value={request.id} /><input name="slug" type="hidden" value={slug} /><input name="decision" type="hidden" value="approve" /><button className="button button-small" type="submit"><Check size={15} /> Aprobar</button></form><form action={reviewOrganizationRequest}><input name="requestId" type="hidden" value={request.id} /><input name="slug" type="hidden" value={slug} /><input name="decision" type="hidden" value="reject" /><button className="button button-secondary button-small" type="submit"><X size={15} /> Rechazar</button></form></div></article>)}
        {requests.length === 0 && <p className="organization-muted">No hay solicitudes pendientes.</p>}
      </section>}

      <section className="organization-panel organization-members-list">
        <div className="organization-section-heading"><div><p className="eyebrow"><Users size={13} /> Comunidad</p><h2>Miembros</h2></div><span>{members.length}</span></div>
        {members.map((member) => {
          const canManageRole = organization.viewerRole === "owner" && member.user_id !== organization.viewerId;
          const canRemove = canAdmin && member.user_id !== organization.viewerId && (organization.viewerRole === "owner" || member.role === "member");
          return <article className="organization-member" key={member.user_id}>
            <Link className="person-identity" href={`/u/${member.profile.handle}`}><span className="avatar avatar-small">{member.profile.display_name.slice(0, 2).toUpperCase()}</span><span><strong>{member.profile.display_name}</strong><small>@{member.profile.handle}</small></span></Link>
            <span className={`organization-role organization-role-${member.role}`}><ShieldCheck size={13} /> {organizationRoleLabels[member.role]}</span>
            <div className="organization-member-actions">
              {canManageRole && <form action={changeOrganizationMemberRole}><input name="organizationId" type="hidden" value={organization.id} /><input name="userId" type="hidden" value={member.user_id} /><input name="slug" type="hidden" value={slug} /><select aria-label={`Rol de ${member.profile.display_name}`} className="select" defaultValue={member.role} name="role"><option value="member">Miembro</option><option value="admin">Administrador</option><option value="owner">Propietario</option></select><button className="button button-secondary button-small" type="submit">Cambiar</button></form>}
              {canRemove && <form action={removeOrganizationMember}><input name="organizationId" type="hidden" value={organization.id} /><input name="userId" type="hidden" value={member.user_id} /><input name="slug" type="hidden" value={slug} /><button aria-label={`Retirar a ${member.profile.display_name}`} className="icon-button" type="submit"><UserMinus size={16} /></button></form>}
            </div>
          </article>;
        })}
      </section>
    </main>
  );
}
