"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { postContentSchema, postIdSchema, postVisibilitySchema, profileSchema } from "./schemas";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  return { supabase, user };
}

function revalidateSocialPages() {
  revalidatePath("/feed");
  revalidatePath("/users");
  revalidatePath("/u/[handle]", "page");
}

export async function createPost(formData: FormData) {
  const content = postContentSchema.safeParse(formData.get("content"));
  const visibility = postVisibilitySchema.safeParse(formData.get("visibility") ?? "public");
  const rawDeckId = formData.get("deckId");
  const deckId = rawDeckId ? z.string().uuid().safeParse(rawDeckId) : null;
  if (!content.success || !visibility.success || (deckId && !deckId.success)) return;

  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("create_social_post", {
    p_content: content.data,
    p_visibility: visibility.data,
    p_deck_id: deckId?.data ?? null,
  });

  if (error) throw new Error("No se pudo publicar el mensaje.");
  revalidateSocialPages();
}

export async function toggleLike(formData: FormData) {
  const postId = postIdSchema.safeParse(formData.get("postId"));
  if (!postId.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("toggle_post_like", { p_post_id: postId.data });
  if (error) throw new Error("No se pudo actualizar el favorito.");
  revalidateSocialPages();
}

export async function toggleRepost(formData: FormData) {
  const postId = postIdSchema.safeParse(formData.get("postId"));
  if (!postId.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("toggle_repost", { p_post_id: postId.data });
  if (error) throw new Error("No se pudo actualizar el repost.");
  revalidateSocialPages();
}

export async function toggleFollow(formData: FormData) {
  const profileId = z.string().uuid().safeParse(formData.get("profileId"));
  if (!profileId.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("toggle_follow", { p_profile_id: profileId.data });
  if (error) throw new Error("No se pudo actualizar el seguimiento.");
  revalidateSocialPages();
}

export async function updateProfile(formData: FormData) {
  const profile = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    handle: formData.get("handle"),
    bio: formData.get("bio") ?? "",
    favoriteFormats: formData.getAll("favoriteFormats"),
  });

  if (!profile.success) {
    redirect("/settings/profile?error=Revisa el nombre, el usuario y la biografía.");
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("profiles").update({
    display_name: profile.data.displayName,
    handle: profile.data.handle,
    bio: profile.data.bio,
    favorite_formats: profile.data.favoriteFormats,
  }).eq("id", user.id);

  if (error) {
    const message = error.code === "23505" ? "Ese nombre de usuario ya está ocupado." : "No se pudo guardar el perfil.";
    redirect(`/settings/profile?error=${encodeURIComponent(message)}`);
  }

  revalidateSocialPages();
  redirect(`/u/${profile.data.handle}`);
}
