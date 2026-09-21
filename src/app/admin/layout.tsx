import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, Layers3, LayoutDashboard, Shapes, Users } from "lucide-react";
import { requireAdminAccess } from "@/features/admin/auth";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdminAccess();

  return (
    <main className="page-shell admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">Área privada</p><h1 className="page-title">Administración</h1><p>Gestiona el contenido editorial y las herramientas internas de Spellbook.</p></div>
      </header>
      <nav aria-label="Secciones de administración" className="admin-nav">
        <Link href="/admin"><LayoutDashboard size={16} /> Resumen</Link>
        <Link href="/admin/formats"><BookOpen size={16} /> Formatos</Link>
        <Link href="/admin/archetypes"><Shapes size={16} /> Arquetipos</Link>
        <Link href="/admin/users"><Users size={16} /> Usuarios</Link>
        <Link href="/admin/organizations"><Building2 size={16} /> Organizaciones</Link>
        <Link href="/admin/decklists"><Layers3 size={16} /> Decklists</Link>
      </nav>
      {children}
    </main>
  );
}
