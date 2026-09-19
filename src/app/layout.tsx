import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, Building2, Home, Layers3, Users } from "lucide-react";
import { AccountButton } from "@/components/account-button";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Spellbook — comparte ideas, construye mazos",
    template: "%s · Spellbook",
  },
  description:
    "Una comunidad para compartir ideas, cartas y decklists de Magic: The Gathering.",
};

const navigation = [
  { href: "/feed", label: "Inicio", icon: Home },
  { href: "/decks", label: "Decklists", icon: Layers3 },
  { href: "/users", label: "Jugadores", icon: Users },
  { href: "/organizations", label: "Organizaciones", icon: Building2 },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let authenticated = false;
  let profileHandle: string | null = null;
  let isAdmin = false;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    authenticated = Boolean(user);

    if (user) {
      const [{ data: profile }, { data: adminAccess }] = await Promise.all([
        supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle(),
        supabase.rpc("is_admin"),
      ]);
      profileHandle = profile?.handle ?? null;
      isAdmin = adminAccess === true;
    }
  }

  return (
    <html data-scroll-behavior="smooth" lang="es">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href={authenticated ? "/feed" : "/"} aria-label={authenticated ? "Spellbook, ir al feed" : "Spellbook, inicio"}>
              <span className="brand-mark"><BookOpenText size={20} /></span>
              <span>Spellbook</span>
              <span className="beta-pill">alpha</span>
            </Link>
            <nav className="main-nav" aria-label="Navegación principal">
              {navigation.map(({ href, label, icon: Icon }) => (
                <Link href={href} key={href}>
                  <Icon size={17} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <AccountButton authenticated={authenticated} isAdmin={isAdmin} profileHandle={profileHandle} />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <p>Spellbook es contenido de fans no oficial. No está aprobado ni respaldado por Wizards of the Coast.</p>
          <p>Los materiales de Magic pertenecen a Wizards of the Coast LLC. Datos e imágenes de cartas: Scryfall.</p>
        </footer>
      </body>
    </html>
  );
}
