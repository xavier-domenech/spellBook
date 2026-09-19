import { createAdminClient } from "@/lib/supabase/admin";

type Channel = { id: string; profile_id: string; platform: "youtube" | "twitch"; external_id: string; channel_name: string; channel_url: string };
type FeedEvent = { id: string; title: string; url: string; publishedAt: string | null };

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() ?? "";
}

async function youtubeEvents(channel: Channel): Promise<FeedEvent[]> {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.external_id)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`YouTube feed respondió ${response.status}.`);
  const xml = await response.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].slice(0, 5).map((match) => {
    const entry = match[1];
    const id = readTag(entry, "yt:videoId");
    const title = readTag(entry, "title");
    const published = readTag(entry, "published");
    return { id: `youtube:${id}`, title, url: `https://www.youtube.com/watch?v=${id}`, publishedAt: published || null };
  }).filter((event) => event.id !== "youtube:");
}

async function twitchAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltan las credenciales de Twitch.");
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`Twitch token respondió ${response.status}.`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Twitch no devolvió un token de aplicación.");
  return payload.access_token;
}

async function twitchEvents(channels: Channel[]): Promise<Map<string, FeedEvent[]>> {
  const token = await twitchAppToken();
  const clientId = process.env.TWITCH_CLIENT_ID as string;
  const query = new URLSearchParams();
  for (const channel of channels) query.append("user_id", channel.external_id);
  const response = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
    headers: { Authorization: `Bearer ${token}`, "Client-Id": clientId }, cache: "no-store",
  });
  if (!response.ok) throw new Error(`Twitch streams respondió ${response.status}.`);
  const payload = (await response.json()) as { data?: Array<{ id: string; user_id: string; title: string; started_at: string }> };
  const events = new Map<string, FeedEvent[]>();
  for (const stream of payload.data ?? []) events.set(stream.user_id, [{ id: `twitch:${stream.id}`, title: stream.title || "Directo en Twitch", url: channels.find((channel) => channel.external_id === stream.user_id)?.channel_url ?? "https://www.twitch.tv", publishedAt: stream.started_at }]);
  return events;
}

async function publishEvent(supabase: ReturnType<typeof createAdminClient>, channel: Channel, event: FeedEvent) {
  const { data: existing, error: insertError } = await supabase.from("creator_events").upsert({
    channel_id: channel.id, platform: channel.platform, external_event_id: event.id.replace(`${channel.platform}:`, ""), title: event.title, content_url: event.url, published_at: event.publishedAt,
  }, { onConflict: "platform,external_event_id", ignoreDuplicates: true }).select("id, processed_at").maybeSingle();
  if (insertError) throw insertError;
  if (!existing || existing.processed_at) return false;
  const content = `📡 ${channel.platform === "youtube" ? "Nuevo vídeo" : "Directo en Twitch"} de ${channel.channel_name}: ${event.title} ${event.url}`.slice(0, 500);
  const { data: post, error: postError } = await supabase.from("posts").insert({ author_id: channel.profile_id, content, visibility: "public" }).select("id").single();
  if (postError) {
    await supabase.from("creator_events").update({ last_error: postError.message }).eq("id", existing.id);
    throw postError;
  }
  await supabase.from("creator_events").update({ post_id: post.id, processed_at: new Date().toISOString(), last_error: null }).eq("id", existing.id);
  return true;
}

export async function syncCreatorEvents() {
  const supabase = createAdminClient();
  const { data: channels, error } = await supabase.from("creator_channels").select("id, profile_id, platform, external_id, channel_name, channel_url").eq("auto_publish", true);
  if (error) throw error;
  const allChannels = (channels ?? []) as Channel[];
  const youtube = allChannels.filter((channel) => channel.platform === "youtube");
  const twitch = allChannels.filter((channel) => channel.platform === "twitch");
  let published = 0;
  for (const channel of youtube) for (const event of await youtubeEvents(channel)) if (await publishEvent(supabase, channel, event)) published += 1;
  if (twitch.length > 0) {
    const twitchEventMap = await twitchEvents(twitch);
    for (const channel of twitch) for (const event of twitchEventMap.get(channel.external_id) ?? []) if (await publishEvent(supabase, channel, event)) published += 1;
  }
  return { channels: allChannels.length, published };
}
