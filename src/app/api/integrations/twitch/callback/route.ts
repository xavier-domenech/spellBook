import { redirect } from "next/navigation";
import { consumeOAuthState, creatorCallbackUrl, oauthError } from "@/lib/creators/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries()) as { code?: string; error?: string; state?: string };
  if (!(await consumeOAuthState("twitch", params.state ?? null))) redirect(oauthError("twitch", "La verificación de seguridad ha caducado."));
  if (params.error || !params.code || !process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) redirect(oauthError("twitch", "No se pudo autorizar el canal."));

  const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: creatorCallbackUrl("twitch"),
    }),
  });
  if (!tokenResponse.ok) redirect(oauthError("twitch", "Twitch rechazó la autorización."));
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) redirect(oauthError("twitch", "Twitch no devolvió un token válido."));

  const userResponse = await fetch("https://api.twitch.tv/helix/users", {
    headers: { Authorization: `Bearer ${token.access_token}`, "Client-Id": process.env.TWITCH_CLIENT_ID },
  });
  if (!userResponse.ok) redirect(oauthError("twitch", "No se pudo leer el canal de Twitch."));
  const userPayload = (await userResponse.json()) as { data?: Array<{ id: string; login: string; display_name: string }> };
  const channel = userPayload.data?.[0];
  if (!channel) redirect(oauthError("twitch", "La cuenta no tiene un canal de Twitch disponible."));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { error } = await supabase.from("creator_channels").upsert({
    profile_id: user.id,
    platform: "twitch",
    external_id: channel.id,
    channel_name: channel.display_name,
    channel_url: `https://www.twitch.tv/${channel.login}`,
    verified_at: new Date().toISOString(),
  }, { onConflict: "profile_id,platform" });
  if (error) redirect(oauthError("twitch", error.code === "23505" ? "Ese canal ya está vinculado a otra cuenta." : "No se pudo guardar el canal."));
  redirect("/settings/profile?creatorConnected=twitch");
}
