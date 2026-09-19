import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Radio, Save, Unplug, Video } from "lucide-react";
import { redirect } from "next/navigation";
import { disconnectCreatorChannel, setCreatorAutoPublish } from "@/features/creators/actions";
import { updateProfile } from "@/features/social/actions";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar perfil" };

type SettingsPageProps = { searchParams: Promise<{ error?: string; creatorError?: string; creatorConnected?: string }> };
type CreatorChannel = { id: string; platform: "youtube" | "twitch"; channel_name: string; channel_url: string; verified_at: string; auto_publish: boolean };
const formats = ["commander", "standard", "modern", "pioneer"] as const;

export default async function ProfileSettingsPage({ searchParams }: SettingsPageProps) {
  if (!hasSupabaseEnv()) redirect("/auth");
  const { error, creatorError, creatorConnected } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name, bio, favorite_formats")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/auth");
  const { data: creatorChannels } = await supabase
    .from("creator_channels")
    .select("id, platform, channel_name, channel_url, verified_at, auto_publish")
    .eq("profile_id", user.id)
    .order("platform");
  const channels = (creatorChannels ?? []) as CreatorChannel[];

  return (
    <main className="auth-shell">
      <section className="form-card profile-form">
        <p className="eyebrow">Identidad pública</p>
        <h1>Edita tu perfil</h1>
        <p>Estos datos aparecerán junto a tus publicaciones y decklists.</p>
        {error && <div className="form-message" role="alert">{error}</div>}
        {creatorError && <div className="form-message" role="alert">{creatorError}</div>}
        {creatorConnected && <div className="form-message">{creatorConnected === "youtube" ? "YouTube" : "Twitch"} conectado y verificado.</div>}
        <form action={updateProfile}>
          <div className="field"><label htmlFor="displayName">Nombre visible</label><input className="input" defaultValue={profile.display_name} id="displayName" maxLength={60} name="displayName" required /></div>
          <div className="field"><label htmlFor="handle">Usuario</label><div className="input-prefix"><span>@</span><input defaultValue={profile.handle} id="handle" maxLength={30} minLength={3} name="handle" pattern="[a-zA-Z0-9_]+" required /></div></div>
          <div className="field"><label htmlFor="bio">Biografía</label><textarea className="textarea textarea-short" defaultValue={profile.bio} id="bio" maxLength={300} name="bio" placeholder="Cuéntanos qué formatos juegas…" /></div>
          <fieldset className="format-fieldset"><legend>Formatos favoritos</legend><div className="format-options">{formats.map((format) => <label key={format}><input defaultChecked={profile.favorite_formats.includes(format)} name="favoriteFormats" type="checkbox" value={format} /><span>{format}</span></label>)}</div></fieldset>
          <button className="button" type="submit"><Save size={17} /> Guardar cambios</button>
        </form>

        <section className="creator-section" aria-labelledby="creator-heading">
          <p className="eyebrow">Identidad de creador</p>
          <h2 id="creator-heading">Canales verificados</h2>
          <p>Conecta tus cuentas mediante OAuth. Solo guardamos el identificador público verificado; nunca almacenamos tokens de acceso.</p>
          <div className="creator-connect-list">
            {channels.map((channel) => {
              const isYoutube = channel.platform === "youtube";
              return (
                <div className="creator-channel" key={channel.id}>
                  <div className="creator-channel-meta">
                    <span className="feature-icon">{isYoutube ? <Video size={18} /> : <Radio size={18} />}</span>
                    <span><strong>{channel.channel_name}</strong><small>{isYoutube ? "YouTube" : "Twitch"} · <CheckCircle2 size={13} /> Verificado</small></span>
                  </div>
                  <div className="creator-channel-actions">
                    <Link className="button button-secondary button-small" href={channel.channel_url} rel="noreferrer" target="_blank"><ExternalLink size={14} /> Ver canal</Link>
                    <form action={setCreatorAutoPublish}>
                      <input name="channelId" type="hidden" value={channel.id} />
                      <label className="creator-toggle"><input defaultChecked={channel.auto_publish} name="autoPublish" type="checkbox" /><span>Avisos automáticos</span></label>
                      <button className="button button-small" type="submit">Guardar</button>
                    </form>
                    <form action={disconnectCreatorChannel}><input name="channelId" type="hidden" value={channel.id} /><button className="icon-button" title="Desconectar canal" type="submit"><Unplug size={16} /></button></form>
                  </div>
                </div>
              );
            })}
            {(["youtube", "twitch"] as const).filter((platform) => !channels.some((channel) => channel.platform === platform)).map((platform) => (
              <div className="creator-channel creator-channel-empty" key={platform}>
                <div className="creator-channel-meta"><span className="feature-icon">{platform === "youtube" ? <Video size={18} /> : <Radio size={18} />}</span><span><strong>{platform === "youtube" ? "YouTube" : "Twitch"}</strong><small>Aún no conectado</small></span></div>
                <Link className="button button-secondary button-small" href={`/api/integrations/${platform}/start`}>Conectar</Link>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
