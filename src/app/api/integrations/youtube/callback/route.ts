import { redirect } from "next/navigation";
import { consumeOAuthState, creatorCallbackUrl, oauthError } from "@/lib/creators/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries()) as { code?: string; error?: string; state?: string };
  if (!(await consumeOAuthState("youtube", params.state ?? null))) redirect(oauthError("youtube", "La verificación de seguridad ha caducado."));
  if (params.error || !params.code || !process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) redirect(oauthError("youtube", "No se pudo autorizar el canal."));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: creatorCallbackUrl("youtube"),
    }),
  });
  if (!tokenResponse.ok) redirect(oauthError("youtube", "Google rechazó la autorización."));
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) redirect(oauthError("youtube", "Google no devolvió un token válido."));

  const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!channelResponse.ok) redirect(oauthError("youtube", "No se pudo leer el canal de YouTube."));
  const channelPayload = (await channelResponse.json()) as { items?: Array<{ id: string; snippet?: { title?: string } }> };
  const channel = channelPayload.items?.[0];
  if (!channel) redirect(oauthError("youtube", "La cuenta no tiene un canal de YouTube disponible."));

  const { error } = await supabase.from("creator_channels").upsert({
    profile_id: user.id,
    platform: "youtube",
    external_id: channel.id,
    channel_name: channel.snippet?.title ?? "Canal de YouTube",
    channel_url: `https://www.youtube.com/channel/${channel.id}`,
    verified_at: new Date().toISOString(),
  }, { onConflict: "profile_id,platform" });
  if (error) redirect(oauthError("youtube", error.code === "23505" ? "Ese canal ya está vinculado a otra cuenta." : "No se pudo guardar el canal."));
  redirect("/settings/profile?creatorConnected=youtube");
}
