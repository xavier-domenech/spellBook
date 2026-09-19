import Link from "next/link";
import { LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { logout } from "@/app/auth/actions";

type AccountButtonProps = {
  authenticated: boolean;
  profileHandle: string | null;
  isAdmin: boolean;
};

export function AccountButton({ authenticated, profileHandle, isAdmin }: AccountButtonProps) {
  if (!authenticated) return <Link className="button button-small" href="/auth"><LogIn size={16} /> Entrar</Link>;

  return (
    <div className="account-actions">
      {isAdmin && (
        <Link aria-label="Administración" className="button button-secondary button-small" href="/admin">
          <ShieldCheck size={16} /> <span>Admin</span>
        </Link>
      )}
      <Link aria-label="Mi perfil" className="button button-small" href={profileHandle ? `/u/${profileHandle}` : "/settings/profile"}>
        <UserRound size={16} /> <span>Mi perfil</span>
      </Link>
      <form action={logout}>
        <button aria-label="Cerrar sesión" className="button button-secondary button-small" type="submit">
          <LogOut size={16} /> <span>Cerrar sesión</span>
        </button>
      </form>
    </div>
  );
}
