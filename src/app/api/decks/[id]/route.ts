import { NextResponse } from "next/server";
import { z } from "zod";
import { loadDeckDetail } from "@/features/decks/detail";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const parsedId = z.string().uuid().safeParse((await params).id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "El identificador del mazo no es válido." }, { status: 400 });
  }

  const versionId = z.string().uuid().nullable().safeParse(new URL(request.url).searchParams.get("version"));
  if (!versionId.success) return NextResponse.json({ error: "La versión no es válida." }, { status: 400 });

  try {
    const details = await loadDeckDetail(parsedId.data, versionId.data ?? undefined);
    if (!details) return NextResponse.json({ error: "No encontramos ese mazo o no tienes permiso para verlo." }, { status: 404 });
    return NextResponse.json(details, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el mazo." }, { status: 500 });
  }
}
