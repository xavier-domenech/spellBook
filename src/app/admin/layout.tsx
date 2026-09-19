import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, Shapes } from "lucide-react";
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
        <Link href="/admin/archetypes"><Shapes size={16} /> Arquetipos</Link>
      </nav>
      {children}
    </main>
  );
}
