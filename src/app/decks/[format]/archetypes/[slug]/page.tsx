import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DeckLibraryGrid, LibraryPagination } from "@/components/deck-library-grid";
import { deckFormatSchema, firstParam, pageNumberSchema } from "@/features/decks/formats";
import { type Archetype, loadLibrary } from "@/features/decks/library";
import { loadFormat } from "@/features/formats/data";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ format: string; slug: string }>; searchParams: Promise<{ page?: string | string[] }> };

export default async function ArchetypePage({ params, searchParams }: Props) {
  const route = z.object({ format: deckFormatSchema, slug: z.string().regex(/^[a-z0-9-]+$/).max(150) }).safeParse(await params);
  if (!route.success || !hasSupabaseEnv()) notFound();
  const { format, slug } = route.data;
  const formatInfo = await loadFormat(format, { includeArchived: true });
  if (!formatInfo) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("archetype_catalog").select("*").eq("format", format).eq("slug", slug).maybeSingle();
  if (error) throw new Error("No se pudo cargar el arquetipo.");
  if (!data) notFound();
  const group = data as Archetype;
  const page = pageNumberSchema.parse(firstParam((await searchParams).page));
  const result = await loadLibrary(format, { page, archetypeId: group.id });

  return (
    <main className="page-shell deck-page">
      <Link className="deck-back-link" href={`/decks/${format}`}>← Arquetipos de {formatInfo.name}</Link>
      <header className="deck-intro"><div><p className="eyebrow">{formatInfo.name} · {group.deck_count} listas</p><h1 className="page-title">{group.name}</h1>{group.description && <p>{group.description}</p>}</div></header>
      {result.error && <p className="form-message" role="alert">No se pudieron cargar las decklists.</p>}
      <DeckLibraryGrid decks={result.decks} />
      {!result.error && <LibraryPagination page={page} count={result.count} href={`/decks/${format}/archetypes/${slug}`} />}
    </main>
  );
}
