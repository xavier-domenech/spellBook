import { redirect } from "next/navigation";
import { createOAuthState, creatorCallbackUrl } from "@/lib/creators/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  if (!process.env.YOUTUBE_CLIENT_ID) redirect("/settings/profile?creatorError=YouTube no está configurado todavía.");

  const state = await createOAuthState("youtube");
  const query = new URLSearchParams({
    access_type: "offline",
    client_id: process.env.YOUTUBE_CLIENT_ID,
    prompt: "consent",
    redirect_uri: creatorCallbackUrl("youtube"),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    state,
  });
  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
}
