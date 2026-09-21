import Link from "next/link";
import { Ban, CheckCircle2, RotateCcw, Save, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { adminUserListSchema } from "@/features/admin/users-schema";
import { loadAdminUsers } from "@/features/admin/users";
import { firstParam } from "@/features/decks/formats";
import { deleteEmptyUser, inviteUser, setUserRole, setUserSuspended, updateUserProfile } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function statusLabel(status: string) {
  if (status === "pending") return "Pendiente";
  if (status === "suspended") return "Suspendido";
  return "Activo";
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const query = await searchParams;
  const filters = adminUserListSchema.parse({ query: firstParam(query.q), status: firstParam(query.status), page: firstParam(query.page) });
  const saved = z.string().max(50).optional().catch(undefined).parse(firstParam(query.saved));
  const created = z.string().max(254).optional().catch(undefined).parse(firstParam(query.created));
  const deleted = z.string().max(50).optional().catch(undefined).parse(firstParam(query.deleted));
  const error = z.string().max(300).optional().catch(undefined).parse(firstParam(query.error));
  const { users, count, pageSize } = await loadAdminUsers(filters);
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.status !== "all") params.set("status", filters.status);
    if (page > 1) params.set("page", String(page));
    const value = params.toString();
    return `/admin/users${value ? `?${value}` : ""}`;
  }

  return (
    <section aria-labelledby="admin-users-title">
      <div className="admin-section-heading">
        <div><h2 id="admin-users-title">Usuarios</h2><p>Gestiona perfiles, roles y acceso sin exponer credenciales en el navegador.</p></div>
        <span>{count} usuarios</span>
      </div>

      {error && <p className="form-message" role="alert">{error}</p>}
      {(saved || created || deleted) && <p className="admin-success" role="status"><CheckCircle2 size={17} /> {created ? `Invitación enviada a ${created}.` : deleted ? "Cuenta eliminada." : `Cambio guardado: ${saved}.`}</p>}

      <details className="admin-format-create">
        <summary><UserPlus size={16} /> Invitar usuario</summary>
        <form action={inviteUser} className="admin-user-invite-form">
          <div className="field"><label htmlFor="invite-display-name">Nombre visible</label><input className="input" id="invite-display-name" maxLength={60} name="displayName" required /></div>
          <div className="field"><label htmlFor="invite-email">Email</label><input className="input" id="invite-email" maxLength={254} name="email" required type="email" /></div>
          <button className="button" type="submit"><UserPlus size={16} /> Enviar invitación</button>
        </form>
      </details>

      <form className="admin-user-filters">
        <label className="organization-search" htmlFor="admin-user-search"><Search size={17} /><input defaultValue={filters.query} id="admin-user-search" name="q" placeholder="Email, handle o nombre" /></label>
        <select aria-label="Estado" className="select" defaultValue={filters.status} name="status">
          <option value="all">Todos los estados</option><option value="active">Activos</option><option value="pending">Pendientes</option><option value="suspended">Suspendidos</option>
        </select>
        <button className="button button-secondary" type="submit">Filtrar</button>
      </form>

      <div className="admin-user-list">
        {users.map((user) => (
          <article className="admin-user-card" key={user.id}>
            <header>
              <div className="admin-user-identity"><span className="feature-icon"><Users size={19} /></span><div><h3>{user.display_name}</h3><p>{user.email} · @{user.handle}</p></div></div>
              <div className="admin-user-badges"><span className={`admin-status admin-user-status-${user.account_status}`}>{statusLabel(user.account_status)}</span>{user.is_admin && <span className="admin-status admin-user-role"><ShieldCheck size={12} /> Admin</span>}</div>
            </header>

            <form action={updateUserProfile} className="admin-user-profile-form">
              <input name="userId" type="hidden" value={user.id} />
              <div className="field"><label htmlFor={`display-${user.id}`}>Nombre</label><input className="input" defaultValue={user.display_name} id={`display-${user.id}`} maxLength={60} name="displayName" required /></div>
              <div className="field"><label htmlFor={`handle-${user.id}`}>Handle</label><input className="input" defaultValue={user.handle} id={`handle-${user.id}`} maxLength={30} name="handle" pattern="[a-zA-Z0-9_]{3,30}" required /></div>
              <div className="field admin-user-bio"><label htmlFor={`bio-${user.id}`}>Biografía</label><textarea className="textarea textarea-short" defaultValue={user.bio} id={`bio-${user.id}`} maxLength={300} name="bio" /></div>
              <button className="button button-small" type="submit"><Save size={15} /> Guardar perfil</button>
            </form>

            <footer>
              <div className="admin-format-usage"><span>{user.deck_count} mazos</span><span>{user.post_count} publicaciones</span><span>{user.organization_count} organizaciones</span><span>Alta {new Date(user.created_at).toLocaleDateString("es-ES")}</span></div>
              <div className="admin-user-actions">
                <form action={setUserRole}><input name="userId" type="hidden" value={user.id} /><input name="enabled" type="hidden" value={String(!user.is_admin)} /><button className="button button-secondary button-small" type="submit"><ShieldCheck size={14} /> {user.is_admin ? "Retirar admin" : "Hacer admin"}</button></form>
                {user.account_status === "suspended" ? (
                  <form action={setUserSuspended}><input name="userId" type="hidden" value={user.id} /><input name="suspended" type="hidden" value="false" /><button className="button button-secondary button-small" type="submit"><RotateCcw size={14} /> Reactivar</button></form>
                ) : (
                  <form action={setUserSuspended} className="admin-user-moderation"><input name="userId" type="hidden" value={user.id} /><input name="suspended" type="hidden" value="true" /><input aria-label={`Motivo para suspender a ${user.display_name}`} className="input" maxLength={500} minLength={3} name="reason" placeholder="Motivo" required /><button className="button button-secondary button-small" type="submit"><Ban size={14} /> Suspender</button></form>
                )}
                <form action={deleteEmptyUser}><input name="userId" type="hidden" value={user.id} /><ConfirmSubmitButton message="La cuenta solo se eliminará si no tiene contenido. Esta acción es irreversible."><Trash2 size={14} /> Eliminar vacía</ConfirmSubmitButton></form>
              </div>
            </footer>
          </article>
        ))}
        {users.length === 0 && <div className="empty-state"><Users size={28} /><h3>No hay usuarios con estos filtros</h3><p>Prueba otra búsqueda o estado.</p></div>}
      </div>

      {pageCount > 1 && <nav aria-label="Paginación de usuarios" className="pagination"><Link aria-disabled={filters.page <= 1} href={pageHref(Math.max(1, filters.page - 1))}>Anterior</Link><span>Página {filters.page} de {pageCount}</span><Link aria-disabled={filters.page >= pageCount} href={pageHref(Math.min(pageCount, filters.page + 1))}>Siguiente</Link></nav>}
    </section>
  );
}
