"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function ownClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  return { supabase, user };
}

export async function setCreatorAutoPublish(formData: FormData) {
  const channelId = z.string().uuid().safeParse(formData.get("channelId"));
  const enabled = formData.get("autoPublish") === "on";
  if (!channelId.success) return;

  const { supabase, user } = await ownClient();
  const { error } = await supabase.from("creator_channels")
    .update({ auto_publish: enabled })
    .eq("id", channelId.data)
    .eq("profile_id", user.id);
  if (error) redirect(`/settings/profile?creatorError=${encodeURIComponent("No se pudo actualizar la automatización.")}`);
  revalidatePath("/settings/profile");
  revalidatePath("/u/[handle]", "page");
}

export async function disconnectCreatorChannel(formData: FormData) {
  const channelId = z.string().uuid().safeParse(formData.get("channelId"));
  if (!channelId.success) return;

  const { supabase, user } = await ownClient();
  const { error } = await supabase.from("creator_channels")
    .delete().eq("id", channelId.data).eq("profile_id", user.id);
  if (error) redirect(`/settings/profile?creatorError=${encodeURIComponent("No se pudo desconectar el canal.")}`);
  revalidatePath("/settings/profile");
  revalidatePath("/u/[handle]", "page");
}
