import { syncCreatorEvents } from "@/features/creators/sync";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    return Response.json(await syncCreatorEvents());
  } catch (error) {
    console.error("creator-sync failed", error);
    return Response.json({ error: "No se pudo sincronizar los canales." }, { status: 500 });
  }
}

export const POST = GET;
