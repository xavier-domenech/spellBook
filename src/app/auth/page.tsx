import type { Metadata } from "next";
import { LogIn, UserPlus } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/env";
import { login, signup } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

type AuthPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();

  return (
    <main className="auth-shell">
      <section className="form-card">
        <p className="eyebrow">Tu mesa te espera</p>
        <h1>Entra en Spellbook</h1>
        <p>Publica ideas, guarda decklists y sigue las conversaciones de tu formato.</p>
        {!configured && (
          <div className="setup-notice">
            Supabase aún no está enlazado. Ejecuta <code>npm run supabase:start</code> y copia las claves locales a <code>.env.local</code>.
          </div>
        )}
        {params.error && <div className="form-message" role="alert">{params.error}</div>}
        {params.message && <div className="setup-notice">{params.message}</div>}
        {configured && (
          <form>
            <div className="field">
              <label htmlFor="displayName">Nombre visible (solo al registrarte)</label>
              <input className="input" id="displayName" name="displayName" placeholder="Jace de la mesa 4" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input autoComplete="email" className="input" id="email" name="email" placeholder="tu@email.com" required type="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input autoComplete="current-password" className="input" id="password" minLength={8} name="password" required type="password" />
            </div>
            <div className="form-actions">
              <button className="button button-secondary" formAction={login}><LogIn size={17} /> Entrar</button>
              <button className="button" formAction={signup}><UserPlus size={17} /> Crear cuenta</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
