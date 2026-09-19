import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Feather, Home, Layers3, Settings, UserRound, Users } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "@/features/social/actions";
import { loadSocialPosts } from "@/features/social/data";
import { PostCard } from "@/components/post-card";

export const metadata: Metadata = { title: "Feed" };

type FeedPageProps = {
  searchParams: Promise<{ scope?: string }>;
};

type OwnedDeck = { id: string; title: string; format: string };
type SuggestedProfile = { id: string; handle: string; display_name: string };

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { scope } = await searchParams;
  const followingOnly = scope === "following";
  const configured = hasSupabaseEnv();
  let user: { id: string } | null = null;
  let ownProfile: { handle: string; display_name: string } | null = null;
  let ownedDecks: OwnedDeck[] = [];
  let suggestions: SuggestedProfile[] = [];
  let authorIds: string[] | undefined;
  let excludedAuthorIds: string[] = [];

  if (configured) {
    const supabase = await createClient();
    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;

    if (user) {
      const [profileResult, decksResult, followsResult, mutesResult, blocksResult, suggestionsResult] = await Promise.all([
        supabase.from("profiles").select("handle, display_name").eq("id", user.id).maybeSingle(),
        supabase.from("decks").select("id, title, format").eq("owner_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("follows").select("followed_id").eq("follower_id", user.id),
        supabase.from("mutes").select("muted_id").eq("muter_id", user.id),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
        supabase.from("profiles").select("id, handle, display_name").neq("id", user.id).limit(3),
      ]);

      ownProfile = profileResult.data;
      ownedDecks = (decksResult.data ?? []) as OwnedDeck[];
      suggestions = (suggestionsResult.data ?? []) as SuggestedProfile[];
      const followedIds = (followsResult.data ?? []).map((follow) => follow.followed_id);
      if (followingOnly) authorIds = [user.id, ...followedIds];
      excludedAuthorIds = [
        ...(mutesResult.data ?? []).map((mute) => mute.muted_id),
        ...(blocksResult.data ?? []).map((block) => block.blocked_id),
      ];
    }
  }

  const socialResult = configured
    ? await loadSocialPosts({ viewerId: user?.id, authorIds, excludedAuthorIds })
    : { posts: [], error: null };

  return (
    <main className="page-shell workspace">
      <aside className="side-panel">
        <nav className="side-nav" aria-label="Secciones del feed">
          <Link className="active" href="/feed"><Home size={18} /> Inicio</Link>
          <Link href="/decks"><Layers3 size={18} /> Decklists</Link>
          <Link href="/users"><Users size={18} /> Jugadores</Link>
          <Link href="/feed"><Bell size={18} /> Notificaciones</Link>
          <Link href={ownProfile ? `/u/${ownProfile.handle}` : "/auth"}><UserRound size={18} /> Perfil</Link>
          <Link href="/settings/profile"><Settings size={18} /> Ajustes</Link>
        </nav>
      </aside>

      <section className="feed-column">
        <header className="feed-header">
          <h1>Tu mesa</h1>
          <nav className="feed-tabs" aria-label="Tipo de feed">
            <Link className={!followingOnly ? "active" : ""} href="/feed">Comunidad</Link>
            <Link className={followingOnly ? "active" : ""} href="/feed?scope=following">Siguiendo</Link>
          </nav>
        </header>
        {user ? (
          <form action={createPost} className="composer">
            <div className="composer-row">
              <span className="avatar">{(ownProfile?.display_name ?? "Tú").slice(0, 2).toUpperCase()}</span>
              <textarea aria-label="Contenido de la publicación" maxLength={500} name="content" placeholder="¿Qué estás construyendo?" required />
            </div>
            <div className="composer-options">
              <label><span>Quién puede verlo</span><select className="select select-compact" defaultValue="public" name="visibility"><option value="public">Todo el mundo</option><option value="followers">Seguidores</option><option value="private">Solo yo</option></select></label>
              <label><span>Decklist</span><select className="select select-compact" defaultValue="" name="deckId"><option value="">Sin mazo adjunto</option>{ownedDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title} · {deck.format}</option>)}</select></label>
              <button className="button button-small" type="submit"><Feather size={15} /> Publicar</button>
            </div>
          </form>
        ) : (
          <div className="composer"><p>Inicia sesión para participar en la conversación.</p><Link className="button button-small" href="/auth">Entrar o crear cuenta</Link></div>
        )}

        {!configured && <div className="setup-notice" style={{ margin: 20 }}>El feed estará disponible al iniciar Supabase local y configurar <code>.env.local</code>.</div>}
        {socialResult.error && <div className="form-message" style={{ margin: 20 }}>La base de datos respondió: {socialResult.error}</div>}
        {socialResult.posts.map((post) => <PostCard canInteract={Boolean(user)} key={post.id} post={post} />)}
        {configured && socialResult.posts.length === 0 && !socialResult.error && (
          <div className="empty-state"><Feather size={30} /><h2>{followingOnly ? "Aún no hay publicaciones aquí" : "La mesa está preparada"}</h2><p>{followingOnly ? "Sigue a otros jugadores o publica algo para estrenar este feed." : "Sé la primera persona en publicar. Las nuevas conversaciones aparecerán aquí."}</p></div>
        )}
      </section>

      <aside className="aside-panel">
        <h2>Personas por descubrir</h2>
        {suggestions.map((profile) => <Link className="suggestion" href={`/u/${profile.handle}`} key={profile.id}><span className="avatar avatar-small">{profile.display_name.slice(0, 2).toUpperCase()}</span><span><strong>{profile.display_name}</strong><small>@{profile.handle}</small></span></Link>)}
        {suggestions.length === 0 && <div className="aside-tip"><strong>La comunidad empieza aquí</strong><span>Los nuevos perfiles aparecerán en este espacio.</span></div>}
        <div className="aside-tip"><strong>Consejo</strong><span>Adjunta una decklist para dar contexto a tu publicación.</span></div>
      </aside>
    </main>
  );
}
