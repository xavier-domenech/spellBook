import { createClient } from "@/lib/supabase/server";

export type DeckAttachment = {
  postId: string;
  deckId: string;
  deckVersionId: string;
  version: number;
  title: string;
  format: string;
  totalCards: number;
};

export type SocialPost = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  profile: { handle: string; displayName: string } | null;
  likesCount: number;
  repostsCount: number;
  viewerHasLiked: boolean;
  viewerHasReposted: boolean;
  attachment: DeckAttachment | null;
};

type PostRow = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles: { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null;
  post_likes: Array<{ count: number }>;
  reposts: Array<{ count: number }>;
};

type AttachmentRow = {
  post_id: string;
  deck_id: string;
  deck_version_id: string;
  version: number;
  title: string;
  format: string;
  total_cards: number | string;
};

type LoadPostOptions = {
  authorId?: string;
  authorIds?: string[];
  excludedAuthorIds?: string[];
  viewerId?: string | null;
  limit?: number;
};

export async function loadSocialPosts(options: LoadPostOptions = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select("id, author_id, content, created_at, profiles!posts_author_id_fkey(handle, display_name), post_likes(count), reposts(count)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 30);

  if (options.authorId) query = query.eq("author_id", options.authorId);
  if (options.authorIds) query = query.in("author_id", options.authorIds);

  const result = await query;
  const excluded = new Set(options.excludedAuthorIds ?? []);
  const rows = ((result.data ?? []) as PostRow[]).filter((post) => !excluded.has(post.author_id));
  const postIds = rows.map((post) => post.id);

  if (postIds.length === 0) return { posts: [] as SocialPost[], error: result.error?.message ?? null };

  const [likesResult, repostsResult, attachmentsResult] = await Promise.all([
    options.viewerId
      ? supabase.from("post_likes").select("post_id").eq("user_id", options.viewerId).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    options.viewerId
      ? supabase.from("reposts").select("post_id").eq("user_id", options.viewerId).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_post_deck_attachments", { p_post_ids: postIds }),
  ]);

  const liked = new Set((likesResult.data ?? []).map((row) => row.post_id));
  const reposted = new Set((repostsResult.data ?? []).map((row) => row.post_id));
  const attachments = new Map(
    ((attachmentsResult.data ?? []) as AttachmentRow[]).map((row) => [row.post_id, {
      postId: row.post_id,
      deckId: row.deck_id,
      deckVersionId: row.deck_version_id,
      version: row.version,
      title: row.title,
      format: row.format,
      totalCards: Number(row.total_cards),
    }]),
  );

  return {
    error: result.error?.message ?? attachmentsResult.error?.message ?? null,
    posts: rows.map((post) => {
      const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
      return {
        id: post.id,
        authorId: post.author_id,
        content: post.content,
        createdAt: post.created_at,
        profile: profile ? { handle: profile.handle, displayName: profile.display_name } : null,
        likesCount: post.post_likes[0]?.count ?? 0,
        repostsCount: post.reposts[0]?.count ?? 0,
        viewerHasLiked: liked.has(post.id),
        viewerHasReposted: reposted.has(post.id),
        attachment: attachments.get(post.id) ?? null,
      } satisfies SocialPost;
    }),
  };
}
