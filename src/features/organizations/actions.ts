"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  announcementSchema,
  forumMessageSchema,
  forumModerationSchema,
  forumTopicSchema,
  organizationFormSchema,
  organizationIdSchema,
  organizationMemberActionSchema,
  organizationRequestDecisionSchema,
  organizationRequestSchema,
  organizationRoleChangeSchema,
  organizationSlugSchema,
} from "./schemas";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  return { supabase, user };
}

function organizationPath(slug: string, suffix = "", values: { error?: string; saved?: string } = {}) {
  const params = new URLSearchParams();
  if (values.error) params.set("error", values.error);
  if (values.saved) params.set("saved", values.saved);
  const query = params.toString();
  return `/organizations/${slug}${suffix}${query ? `?${query}` : ""}`;
}

function revalidateOrganization(slug: string) {
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${slug}`);
  revalidatePath(`/organizations/${slug}/forum`);
  revalidatePath(`/organizations/${slug}/announcements`);
  revalidatePath(`/organizations/${slug}/members`);
}

export async function createOrganization(formData: FormData) {
  const parsed = organizationFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    kind: formData.get("kind"),
    access: formData.get("access"),
    description: formData.get("description") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    location: formData.get("location") ?? "",
    formats: formData.getAll("formats"),
  });
  if (!parsed.success) redirect("/organizations/new?error=Revisa los datos de la organización.");

  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_kind: parsed.data.kind,
    p_access: parsed.data.access,
    p_description: parsed.data.description,
    p_website_url: parsed.data.websiteUrl || null,
    p_location: parsed.data.location || null,
    p_formats: parsed.data.formats,
  });
  if (error) {
    const message = error.code === "23505"
      ? "Ese identificador ya pertenece a otra organización."
      : error.message.includes("limit") ? "Has alcanzado el límite de organizaciones activas." : "No se pudo crear la organización.";
    redirect(`/organizations/new?error=${encodeURIComponent(message)}`);
  }
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "", { saved: "created" }));
}

export async function updateOrganization(formData: FormData) {
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const currentSlug = organizationSlugSchema.safeParse(formData.get("currentSlug"));
  const parsed = organizationFormSchema.safeParse({
    name: formData.get("name"), slug: formData.get("slug"), kind: formData.get("kind"),
    access: formData.get("access"), description: formData.get("description") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "", location: formData.get("location") ?? "",
    formats: formData.getAll("formats"),
  });
  if (!organizationId.success || !currentSlug.success || !parsed.success) {
    redirect("/organizations?error=No se pudieron validar los cambios.");
  }
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("organizations").update({
    name: parsed.data.name,
    slug: parsed.data.slug,
    kind: parsed.data.kind,
    access: parsed.data.access,
    description: parsed.data.description,
    website_url: parsed.data.websiteUrl || null,
    location: parsed.data.location || null,
    formats: parsed.data.formats,
  }).eq("id", organizationId.data).select("id").maybeSingle();
  if (error || !data) {
    const message = error?.code === "23505" ? "Ese identificador ya está ocupado." : "No se pudieron guardar los cambios.";
    redirect(organizationPath(currentSlug.data, "/settings", { error: message }));
  }
  revalidateOrganization(currentSlug.data);
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "/settings", { saved: "1" }));
}

export async function joinOrganization(formData: FormData) {
  const parsed = organizationMemberActionSchema.pick({ organizationId: true, slug: true }).safeParse({
    organizationId: formData.get("organizationId"), slug: formData.get("slug"),
  });
  if (!parsed.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("join_public_organization", { p_organization_id: parsed.data.organizationId });
  if (error) redirect(organizationPath(parsed.data.slug, "", { error: "No se pudo completar la incorporación." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "/forum"));
}

export async function requestOrganizationAccess(formData: FormData) {
  const parsed = organizationRequestSchema.safeParse({
    organizationId: formData.get("organizationId"), slug: formData.get("slug"), message: formData.get("message") ?? "",
  });
  if (!parsed.success) redirect("/organizations?error=La solicitud no es válida.");
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("request_organization_access", {
    p_organization_id: parsed.data.organizationId, p_message: parsed.data.message,
  });
  if (error) {
    const message = error.message.includes("Wait") ? "Debes esperar antes de enviar otra solicitud." : "No se pudo enviar la solicitud.";
    redirect(organizationPath(parsed.data.slug, "", { error: message }));
  }
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "", { saved: "requested" }));
}

export async function cancelOrganizationRequest(formData: FormData) {
  const requestId = organizationIdSchema.safeParse(formData.get("requestId"));
  const slug = organizationSlugSchema.safeParse(formData.get("slug"));
  if (!requestId.success || !slug.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("cancel_organization_request", { p_request_id: requestId.data });
  if (error) redirect(organizationPath(slug.data, "", { error: "No se pudo cancelar la solicitud." }));
  revalidateOrganization(slug.data);
  redirect(organizationPath(slug.data));
}

export async function reviewOrganizationRequest(formData: FormData) {
  const parsed = organizationRequestDecisionSchema.safeParse({
    requestId: formData.get("requestId"), slug: formData.get("slug"), decision: formData.get("decision"),
  });
  if (!parsed.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("review_organization_request", {
    p_request_id: parsed.data.requestId, p_approve: parsed.data.decision === "approve",
  });
  if (error) redirect(organizationPath(parsed.data.slug, "/members", { error: "No se pudo revisar la solicitud." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "/members", { saved: parsed.data.decision }));
}

export async function changeOrganizationMemberRole(formData: FormData) {
  const parsed = organizationRoleChangeSchema.safeParse({
    organizationId: formData.get("organizationId"), userId: formData.get("userId"),
    slug: formData.get("slug"), role: formData.get("role"),
  });
  if (!parsed.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("change_organization_member_role", {
    p_organization_id: parsed.data.organizationId, p_user_id: parsed.data.userId, p_role: parsed.data.role,
  });
  if (error) redirect(organizationPath(parsed.data.slug, "/members", { error: "No se pudo cambiar el rol." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "/members", { saved: "role" }));
}

export async function removeOrganizationMember(formData: FormData) {
  const parsed = organizationMemberActionSchema.safeParse({
    organizationId: formData.get("organizationId"), userId: formData.get("userId"), slug: formData.get("slug"),
  });
  if (!parsed.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("remove_organization_member", {
    p_organization_id: parsed.data.organizationId, p_user_id: parsed.data.userId,
  });
  if (error) redirect(organizationPath(parsed.data.slug, "/members", { error: "No se pudo retirar al miembro." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "/members", { saved: "removed" }));
}

export async function leaveOrganization(formData: FormData) {
  const organizationId = organizationIdSchema.safeParse(formData.get("organizationId"));
  const slug = organizationSlugSchema.safeParse(formData.get("slug"));
  if (!organizationId.success || !slug.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("leave_organization", { p_organization_id: organizationId.data });
  if (error) redirect(organizationPath(slug.data, "", { error: "Transfiere la propiedad antes de abandonar la organización." }));
  revalidateOrganization(slug.data);
  redirect(organizationPath(slug.data));
}

export async function createForumTopic(formData: FormData) {
  const parsed = forumTopicSchema.safeParse({
    organizationId: formData.get("organizationId"), slug: formData.get("slug"),
    title: formData.get("title"), body: formData.get("body"),
  });
  if (!parsed.success) redirect("/organizations?error=Revisa el título y el mensaje.");
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase.from("organization_forum_topics").insert({
    organization_id: parsed.data.organizationId, author_id: user.id,
    title: parsed.data.title, body: parsed.data.body,
  }).select("id").single();
  if (error || !data) redirect(organizationPath(parsed.data.slug, "/forum", { error: "No se pudo crear el tema." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, `/forum/${data.id}`));
}

export async function createForumMessage(formData: FormData) {
  const parsed = forumMessageSchema.safeParse({
    topicId: formData.get("topicId"), slug: formData.get("slug"), body: formData.get("body"),
  });
  if (!parsed.success) return;
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("organization_forum_messages").insert({
    topic_id: parsed.data.topicId, author_id: user.id, body: parsed.data.body,
  });
  if (error) redirect(organizationPath(parsed.data.slug, `/forum/${parsed.data.topicId}`, { error: "No se pudo publicar la respuesta." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, `/forum/${parsed.data.topicId}`, { saved: "reply" }));
}

export async function moderateForumTopic(formData: FormData) {
  const parsed = forumModerationSchema.safeParse({
    topicId: formData.get("topicId"), slug: formData.get("slug"), action: formData.get("action"),
  });
  if (!parsed.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("moderate_organization_topic", {
    p_topic_id: parsed.data.topicId, p_action: parsed.data.action,
  });
  if (error) redirect(organizationPath(parsed.data.slug, `/forum/${parsed.data.topicId}`, { error: "No se pudo moderar el tema." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, `/forum/${parsed.data.topicId}`, { saved: parsed.data.action }));
}

export async function createAnnouncement(formData: FormData) {
  const parsed = announcementSchema.safeParse({
    organizationId: formData.get("organizationId"), slug: formData.get("slug"),
    title: formData.get("title"), body: formData.get("body"), isPinned: formData.get("isPinned") === "on",
  });
  if (!parsed.success) return;
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("organization_announcements").insert({
    organization_id: parsed.data.organizationId, author_id: user.id, title: parsed.data.title,
    body: parsed.data.body, is_pinned: parsed.data.isPinned,
  });
  if (error) redirect(organizationPath(parsed.data.slug, "/announcements", { error: "No se pudo publicar el anuncio." }));
  revalidateOrganization(parsed.data.slug);
  redirect(organizationPath(parsed.data.slug, "/announcements", { saved: "announcement" }));
}

export async function deleteAnnouncement(formData: FormData) {
  const announcementId = z.string().uuid().safeParse(formData.get("announcementId"));
  const slug = organizationSlugSchema.safeParse(formData.get("slug"));
  if (!announcementId.success || !slug.success) return;
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.from("organization_announcements").delete().eq("id", announcementId.data);
  if (error) redirect(organizationPath(slug.data, "/announcements", { error: "No se pudo retirar el anuncio." }));
  revalidateOrganization(slug.data);
  redirect(organizationPath(slug.data, "/announcements"));
}
