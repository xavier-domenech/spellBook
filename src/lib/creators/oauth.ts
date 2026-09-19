import { cookies } from "next/headers";

export const creatorPlatforms = ["youtube", "twitch"] as const;
export type CreatorPlatform = (typeof creatorPlatforms)[number];

const stateCookieNames: Record<CreatorPlatform, string> = {
  youtube: "spellbook_oauth_youtube_state",
  twitch: "spellbook_oauth_twitch_state",
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function creatorCallbackUrl(platform: CreatorPlatform) {
  return `${siteUrl()}/api/integrations/${platform}/callback`;
}

export async function createOAuthState(platform: CreatorPlatform) {
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(stateCookieNames[platform], state, {
    httpOnly: true,
    maxAge: 600,
    path: `/api/integrations/${platform}`,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return state;
}

export async function consumeOAuthState(platform: CreatorPlatform, state: string | null) {
  const cookieStore = await cookies();
  const expected = cookieStore.get(stateCookieNames[platform])?.value;
  cookieStore.delete(stateCookieNames[platform]);
  return Boolean(state && expected && state === expected);
}

export function oauthError(platform: CreatorPlatform, message: string) {
  return `${siteUrl()}/settings/profile?creatorError=${encodeURIComponent(`${platform}: ${message}`)}`;
}
