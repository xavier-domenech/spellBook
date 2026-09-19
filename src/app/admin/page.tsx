import Link from "next/link";
import { ArrowRight, Shapes } from "lucide-react";
import { loadAdminArchetypes } from "@/features/admin/archetypes";

export default async function AdminPage() {
  const { count } = await loadAdminArchetypes();

  return (
    <section aria-labelledby="admin-modules-title">
      <div className="admin-section-heading"><div><h2 id="admin-modules-title">Módulos</h2><p>La estructura está preparada para incorporar nuevas áreas sin mezclar permisos con los perfiles públicos.</p></div></div>
      <div className="admin-module-grid">
        <Link className="admin-module-card" href="/admin/archetypes">
          <span className="feature-icon"><Shapes size={20} /></span>
          <div><h3>Arquetipos</h3><p>Revisa nombres, URLs, descripciones y estado editorial.</p><small>{count} arquetipos publicados</small></div>
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
