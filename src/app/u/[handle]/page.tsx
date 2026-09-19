import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ExternalLink, Layers3, Settings, UserCheck, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { toggleFollow } from "@/features/social/actions";
import { loadSocialPosts } from "@/features/social/data";
import { handleSchema } from "@/features/social/schemas";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfil" };

type ProfilePageProps = { params: Promise<{ handle: string }> };
type PublicDeck = { id: string; title: string; format: string; current_version: number; updated_at: string };
type PublicCreatorChannel = { platform: "youtube" | "twitch"; channel_name: string; channel_url: string };

export default async function ProfilePage({ params }: ProfilePageProps) {
  if (!hasSupabaseEnv()) notFound();
  const parsedHandle = handleSchema.safeParse((await params).handle);
  if (!parsedHandle.success) notFound();
  const handle = parsedHandle.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, favorite_formats, created_at")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) notFound();

  const [followersResult, followingResult, decksResult, followResult, postsResult, creatorChannelsResult] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("followed_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("decks").select("id, title, format, current_version, updated_at").eq("owner_id", profile.id).order("updated_at", { ascending: false }).limit(6),
    user && user.id !== profile.id
      ? supabase.from("follows").select("followed_id").eq("follower_id", user.id).eq("followed_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadSocialPosts({ authorId: profile.id, viewerId: user?.id }),
    supabase.from("creator_channels").select("platform, channel_name, channel_url").eq("profile_id", profile.id).order("platform"),
  ]);

  const ownProfile = user?.id === profile.id;
  const isFollowing = Boolean(followResult.data);
  const decks = (decksResult.data ?? []) as PublicDeck[];
  const creatorChannels = (creatorChannelsResult.data ?? []) as PublicCreatorChannel[];
  const initials = profile.display_name.split(" ").map((word: string) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="page-shell profile-page">
      <section className="profile-hero">
        <div className="profile-banner" />
        <div className="profile-summary">
          <div className="avatar profile-avatar">{initials}</div>
          <div className="profile-actions">
            {ownProfile ? (
              <Link className="button button-secondary button-small" href="/settings/profile"><Settings size={16} /> Editar perfil</Link>
            ) : user ? (
              <form action={toggleFollow}>
                <input name="profileId" type="hidden" value={profile.id} />
                <button className={`button button-small ${isFollowing ? "button-secondary" : ""}`} type="submit">{isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}{isFollowing ? "Siguiendo" : "Seguir"}</button>
              </form>
            ) : (
              <Link className="button button-small" href="/auth"><UserPlus size={16} /> Seguir</Link>
            )}
          </div>
          <h1>{profile.display_name}</h1>
          <p className="profile-handle">@{profile.handle}</p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          <div className="profile-details"><span><CalendarDays size={15} /> Se unió en {new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(new Date(profile.created_at))}</span></div>
          {profile.favorite_formats.length > 0 && <div className="format-pills">{profile.favorite_formats.map((format: string) => <span key={format}>{format}</span>)}</div>}
          {creatorChannels.length > 0 && <div className="profile-creator-links">{creatorChannels.map((channel) => <a href={channel.channel_url} key={channel.platform} rel="noreferrer" target="_blank"><ExternalLink size={14} /> {channel.channel_name} · {channel.platform === "youtube" ? "YouTube" : "Twitch"}</a>)}</div>}
          <div className="profile-stats"><span><strong>{followingResult.count ?? 0}</strong> siguiendo</span><span><strong>{followersResult.count ?? 0}</strong> seguidores</span><span><strong>{decks.length}</strong> mazos visibles</span></div>
        </div>
      </section>

      <div className="profile-grid">
        <section className="feed-column">
          <header className="feed-header"><h2>Publicaciones</h2></header>
          {postsResult.posts.map((post) => <PostCard canInteract={Boolean(user)} key={post.id} post={post} />)}
          {postsResult.posts.length === 0 && <div className="empty-state"><h2>Aún no hay publicaciones</h2><p>Cuando {ownProfile ? "publiques" : "publique"} algo, aparecerá aquí.</p></div>}
        </section>
        <aside className="profile-decks">
          <div className="preview-heading"><h2>Decklists</h2>{ownProfile && <Link href="/decks/new">Crear</Link>}</div>
          {decks.map((deck) => (
            <Link className="profile-deck-card" href={`/deck/${deck.id}`} key={deck.id}>
              <span className="feature-icon"><Layers3 size={18} /></span>
              <span><small>{deck.format} · v{deck.current_version}</small><strong>{deck.title}</strong></span>
            </Link>
          ))}
          {decks.length === 0 && <p className="microcopy">No hay mazos visibles todavía.</p>}
        </aside>
      </div>
    </main>
  );
}
