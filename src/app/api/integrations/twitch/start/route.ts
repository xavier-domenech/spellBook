import { redirect } from "next/navigation";
import { createOAuthState, creatorCallbackUrl } from "@/lib/creators/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  if (!process.env.TWITCH_CLIENT_ID) redirect("/settings/profile?creatorError=Twitch no está configurado todavía.");

  const state = await createOAuthState("twitch");
  const query = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: creatorCallbackUrl("twitch"),
    response_type: "code",
    state,
  });
  redirect(`https://id.twitch.tv/oauth2/authorize?${query}`);
}
