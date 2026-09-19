import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserCheck, UserPlus, Users } from "lucide-react";
import { toggleFollow } from "@/features/social/actions";
import { magicFormatSchema, userSearchSchema } from "@/features/social/schemas";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Jugadores",
  description: "Encuentra jugadores de Magic por su nombre de usuario.",
};

type UsersPageProps = {
  searchParams: Promise<{ q?: string | string[]; format?: string | string[] }>;
};

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  favorite_formats: string[];
  followers: Array<{ count: number }>;
};

const formats = magicFormatSchema.options;
const formatLabels: Record<(typeof formats)[number], string> = {
  commander: "Commander",
  standard: "Standard",
  modern: "Modern",
  pioneer: "Pioneer",
};

function usersHref(query: string, format?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (format) params.set("format", format);
  const queryString = params.toString();
  return queryString ? `/users?${queryString}` : "/users";
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawQuery = resolvedSearchParams.q;
  const queryValue = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "";
  const parsedQuery = userSearchSchema.safeParse(queryValue);
  const searchTerm = parsedQuery.success ? parsedQuery.data : "";
  const invalidSearch = Boolean(queryValue && !parsedQuery.success);
  const rawFormat = Array.isArray(resolvedSearchParams.format) ? resolvedSearchParams.format[0] : resolvedSearchParams.format;
  const parsedFormat = magicFormatSchema.safeParse(rawFormat);
  const selectedFormat = parsedFormat.success ? parsedFormat.data : null;
  const configured = hasSupabaseEnv();
  let profiles: ProfileRow[] = [];
  let viewerId: string | null = null;
  let followedIds = new Set<string>();
  let loadError: string | null = null;

  if (configured && !invalidSearch) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    viewerId = user?.id ?? null;

    let profilesQuery = supabase
      .from("profiles")
      .select("id, handle, display_name, bio, favorite_formats, followers:follows!follows_followed_id_fkey(count)")
      .order("handle")
      .limit(48);

    if (searchTerm) {
      profilesQuery = profilesQuery.ilike("handle", `%${searchTerm.replaceAll("_", "\\_")}%`);
    }
    if (selectedFormat) profilesQuery = profilesQuery.contains("favorite_formats", [selectedFormat]);

    const profilesResult = await profilesQuery;
    profiles = (profilesResult.data ?? []) as ProfileRow[];
    loadError = profilesResult.error?.message ?? null;

    if (viewerId && profiles.length > 0) {
      const { data: follows, error } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", viewerId)
        .in("followed_id", profiles.map((profile) => profile.id));
      followedIds = new Set((follows ?? []).map((follow) => follow.followed_id));
      loadError ??= error?.message ?? null;
    }
  }

  return (
    <main className="page-shell people-page">
      <header className="people-header">
        <p className="eyebrow"><Users size={14} /> Comunidad</p>
        <h1 className="page-title">Encuentra jugadores</h1>
        <p>Busca por nombre de usuario y descubre con quién compartir partidas, ideas y decklists.</p>
      </header>

      <form action="/users" className="people-search" method="get" role="search">
        <Search aria-hidden="true" size={19} />
        <label className="sr-only" htmlFor="user-search">Buscar por nombre de usuario</label>
        <input autoComplete="off" defaultValue={searchTerm} id="user-search" maxLength={31} name="q" placeholder="Buscar por @username" />
        {selectedFormat && <input name="format" type="hidden" value={selectedFormat} />}
        {searchTerm && <Link className="people-search-clear" href={usersHref("", selectedFormat ?? undefined)}>Limpiar</Link>}
        <button className="button button-small" type="submit">Buscar</button>
      </form>

      <nav className="people-format-filters" aria-label="Filtrar jugadores por formato favorito">
        <span>Formato favorito</span>
        <Link className={!selectedFormat ? "active" : ""} href={usersHref(searchTerm)}>Todos</Link>
        {formats.map((format) => (
          <Link className={selectedFormat === format ? "active" : ""} href={usersHref(searchTerm, format)} key={format}>
            {formatLabels[format]}
          </Link>
        ))}
      </nav>

      {invalidSearch && <div className="form-message">Usa únicamente letras, números y guiones bajos.</div>}
      {!configured && <div className="setup-notice">Inicia Supabase local y configura <code>.env.local</code> para consultar usuarios.</div>}
      {loadError && <div className="form-message">No se pudo cargar la lista: {loadError}</div>}

      {configured && !invalidSearch && (
        <section aria-label="Lista de jugadores">
          <div className="people-results-heading">
            <h2>
              {searchTerm
                ? `Resultados para @${searchTerm}${selectedFormat ? ` en ${formatLabels[selectedFormat]}` : ""}`
                : selectedFormat ? `Jugadores de ${formatLabels[selectedFormat]}` : "Jugadores de la comunidad"}
            </h2>
            <span>{profiles.length} {profiles.length === 1 ? "perfil" : "perfiles"}</span>
          </div>
          <div className="people-grid">
            {profiles.map((profile) => {
              const initials = profile.display_name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
              const isOwnProfile = viewerId === profile.id;
              const isFollowing = followedIds.has(profile.id);
              return (
                <article className="person-card" key={profile.id}>
                  <Link className="person-identity" href={`/u/${profile.handle}`}>
                    <span className="avatar person-avatar">{initials}</span>
                    <span><strong>{profile.display_name}</strong><small>@{profile.handle}</small></span>
                  </Link>
                  <p>{profile.bio || "Este jugador todavía no ha escrito su biografía."}</p>
                  {profile.favorite_formats.length > 0 && (
                    <div className="format-pills">{profile.favorite_formats.map((format) => <span key={format}>{format}</span>)}</div>
                  )}
                  <footer>
                    <span><strong>{profile.followers[0]?.count ?? 0}</strong> seguidores</span>
                    {isOwnProfile ? (
                      <Link className="button button-secondary button-small" href={`/u/${profile.handle}`}>Ver perfil</Link>
                    ) : viewerId ? (
                      <form action={toggleFollow}>
                        <input name="profileId" type="hidden" value={profile.id} />
                        <button className={`button button-small ${isFollowing ? "button-secondary" : ""}`} type="submit">
                          {isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}{isFollowing ? "Siguiendo" : "Seguir"}
                        </button>
                      </form>
                    ) : (
                      <Link className="button button-small" href="/auth"><UserPlus size={15} /> Seguir</Link>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
          {profiles.length === 0 && !loadError && (
            <div className="empty-state"><Users size={30} /><h2>No encontramos ese usuario</h2><p>Prueba con otra parte del nombre o revisa cómo está escrito.</p></div>
          )}
        </section>
      )}
    </main>
  );
}
