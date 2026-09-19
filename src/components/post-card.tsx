import Link from "next/link";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { SocialPost } from "@/features/social/data";
import { toggleLike, toggleRepost } from "@/features/social/actions";
import { DeckDrawerTrigger } from "@/components/deck-drawer-trigger";

type PostCardProps = {
  post: SocialPost;
  canInteract: boolean;
};

export function PostCard({ post, canInteract }: PostCardProps) {
  const displayName = post.profile?.displayName ?? "Mago anónimo";
  const handle = post.profile?.handle ?? "sin_handle";
  const initials = displayName.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <article className="post">
      <div className="sample-author">
        <Link className="avatar" href={`/u/${handle}`} aria-label={`Perfil de ${displayName}`}>{initials}</Link>
        <div>
          <Link className="author-name" href={`/u/${handle}`}>{displayName}</Link>
          <div className="author-handle">@{handle} · {formatRelativeDate(post.createdAt)}</div>
        </div>
      </div>
      <p className="post-content">{post.content}</p>
      {post.attachment && <DeckDrawerTrigger attachment={post.attachment} />}
      <div className="post-actions">
        <span className="interaction-button"><MessageCircle size={16} /> 0</span>
        {canInteract ? (
          <form action={toggleRepost}>
            <input name="postId" type="hidden" value={post.id} />
            <button aria-pressed={post.viewerHasReposted} className={`interaction-button ${post.viewerHasReposted ? "active repost" : ""}`} type="submit"><Repeat2 size={16} /> {post.repostsCount}</button>
          </form>
        ) : <Link className="interaction-button" href="/auth"><Repeat2 size={16} /> {post.repostsCount}</Link>}
        {canInteract ? (
          <form action={toggleLike}>
            <input name="postId" type="hidden" value={post.id} />
            <button aria-pressed={post.viewerHasLiked} className={`interaction-button ${post.viewerHasLiked ? "active like" : ""}`} type="submit"><Heart fill={post.viewerHasLiked ? "currentColor" : "none"} size={16} /> {post.likesCount}</button>
          </form>
        ) : <Link className="interaction-button" href="/auth"><Heart size={16} /> {post.likesCount}</Link>}
      </div>
    </article>
  );
}
