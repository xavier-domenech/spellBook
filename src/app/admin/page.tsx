import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Shapes, Users } from "lucide-react";
import { loadAdminArchetypes } from "@/features/admin/archetypes";
import { loadAdminFormats } from "@/features/admin/formats";

export default async function AdminPage() {
  const [{ count }, formats] = await Promise.all([loadAdminArchetypes(), loadAdminFormats()]);

  return (
    <section aria-labelledby="admin-modules-title">
      <div className="admin-section-heading"><div><h2 id="admin-modules-title">Módulos</h2><p>La estructura está preparada para incorporar nuevas áreas sin mezclar permisos con los perfiles públicos.</p></div></div>
      <div className="admin-module-grid">
        <Link className="admin-module-card" href="/admin/formats">
          <span className="feature-icon"><BookOpen size={20} /></span>
          <div><h3>Formatos</h3><p>Gestiona el catálogo y las reglas básicas de construcción.</p><small>{formats.filter((format) => format.is_active).length} formatos activos</small></div>
          <ArrowRight size={18} />
        </Link>
        <Link className="admin-module-card" href="/admin/archetypes">
          <span className="feature-icon"><Shapes size={20} /></span>
          <div><h3>Arquetipos</h3><p>Revisa nombres, URLs, descripciones y estado editorial.</p><small>{count} arquetipos publicados</small></div>
          <ArrowRight size={18} />
        </Link>
        <Link className="admin-module-card" href="/admin/users">
          <span className="feature-icon"><Users size={20} /></span>
          <div><h3>Usuarios</h3><p>Gestiona perfiles, roles de plataforma y acceso a las cuentas.</p><small>Identidad y moderación</small></div>
          <ArrowRight size={18} />
        </Link>
        <Link className="admin-module-card" href="/admin/organizations">
          <span className="feature-icon"><Building2 size={20} /></span>
          <div><h3>Organizaciones</h3><p>Supervisa propietarios, configuración, actividad y archivo.</p><small>Gestión de plataforma</small></div>
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
