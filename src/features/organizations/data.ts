import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { z } from "zod";
import type { organizationAccessSchema, organizationKindSchema, organizationRoleSchema } from "./schemas";

export type OrganizationKind = z.infer<typeof organizationKindSchema>;
export type OrganizationAccess = z.infer<typeof organizationAccessSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export type OrganizationSummary = {
  id: string;
  slug: string;
  name: string;
  kind: OrganizationKind;
  access: OrganizationAccess;
  description: string;
  location: string | null;
  website_url: string | null;
  formats: string[];
  members: Array<{ count: number }>;
};

export type OrganizationContext = OrganizationSummary & {
  created_by: string | null;
  viewerId: string | null;
  viewerRole: OrganizationRole | null;
  pendingRequest: { id: string; message: string; created_at: string } | null;
};

export type OrganizationTopic = {
  id: string;
  title: string;
  body: string;
  status: "published" | "hidden";
  is_pinned: boolean;
  is_locked: boolean;
  last_activity_at: string;
  created_at: string;
  author: { handle: string; display_name: string } | null;
  messages: Array<{ count: number }>;
};

export type OrganizationMessage = {
  id: string;
  body: string;
  status: "published" | "hidden";
  created_at: string;
  updated_at: string;
  author: { handle: string; display_name: string } | null;
};

export type OrganizationAnnouncement = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
  updated_at: string;
  author: { handle: string; display_name: string } | null;
};

export const organizationKindLabels: Record<OrganizationKind, string> = {
  league: "Liga",
  team: "Equipo",
  club: "Club",
  store: "Tienda",
  community: "Comunidad",
};

export const organizationRoleLabels: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};

export async function loadOrganizations(filters: { query?: string; kind?: OrganizationKind; access?: OrganizationAccess } = {}) {
  if (!hasSupabaseEnv()) return { organizations: [] as OrganizationSummary[], viewerId: null, error: null };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase.from("organizations")
    .select("id, slug, name, kind, access, description, location, website_url, formats, members:organization_members(count)")
    .is("archived_at", null).order("created_at", { ascending: false }).limit(60);
  if (filters.query) query = query.ilike("name", `%${filters.query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.access) query = query.eq("access", filters.access);
  const { data, error } = await query;
  return {
    organizations: (data ?? []) as OrganizationSummary[],
    viewerId: user?.id ?? null,
    error: error ? "No se pudieron cargar las organizaciones." : null,
  };
}

export async function loadOrganizationContext(slug: string): Promise<OrganizationContext | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const [{ data: { user } }, organizationResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("organizations")
      .select("id, slug, name, kind, access, description, location, website_url, formats, created_by, members:organization_members(count)")
      .eq("slug", slug).is("archived_at", null).maybeSingle(),
  ]);
  const organization = organizationResult.data as Omit<OrganizationContext, "viewerId" | "viewerRole" | "pendingRequest"> | null;
  if (!organization) return null;

  let viewerRole: OrganizationRole | null = null;
  let pendingRequest: OrganizationContext["pendingRequest"] = null;
  if (user) {
    const { data: membership } = await supabase.from("organization_members")
      .select("role").eq("organization_id", organization.id).eq("user_id", user.id).maybeSingle();
    viewerRole = (membership?.role as OrganizationRole | undefined) ?? null;
    if (!viewerRole) {
      const { data: request } = await supabase.from("organization_join_requests")
        .select("id, message, created_at").eq("organization_id", organization.id)
        .eq("requester_id", user.id).eq("status", "pending").maybeSingle();
      pendingRequest = request ?? null;
    }
  }

  return { ...organization, viewerId: user?.id ?? null, viewerRole, pendingRequest };
}

export async function loadOrganizationTopics(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_forum_topics")
    .select("id, title, body, status, is_pinned, is_locked, last_activity_at, created_at, author:profiles!organization_forum_topics_author_id_fkey(handle, display_name), messages:organization_forum_messages(count)")
    .eq("organization_id", organizationId).order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false }).limit(50);
  if (error) throw new Error("No se pudo cargar el foro.");
  return (data ?? []) as unknown as OrganizationTopic[];
}

export async function loadOrganizationTopic(organizationId: string, topicId: string) {
  const supabase = await createClient();
  const [{ data: topic, error: topicError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("organization_forum_topics")
      .select("id, title, body, status, is_pinned, is_locked, last_activity_at, created_at, author:profiles!organization_forum_topics_author_id_fkey(handle, display_name), messages:organization_forum_messages(count)")
      .eq("organization_id", organizationId).eq("id", topicId).maybeSingle(),
    supabase.from("organization_forum_messages")
      .select("id, body, status, created_at, updated_at, author:profiles!organization_forum_messages_author_id_fkey(handle, display_name)")
      .eq("topic_id", topicId).order("created_at").limit(200),
  ]);
  if (topicError || messagesError) throw new Error("No se pudo cargar la conversación.");
  return {
    topic: topic as unknown as OrganizationTopic | null,
    messages: (messages ?? []) as unknown as OrganizationMessage[],
  };
}

export async function loadOrganizationAnnouncements(organizationId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_announcements")
    .select("id, title, body, is_pinned, published_at, updated_at, author:profiles!organization_announcements_author_id_fkey(handle, display_name)")
    .eq("organization_id", organizationId).order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false }).limit(limit);
  if (error) throw new Error("No se pudieron cargar los anuncios.");
  return (data ?? []) as unknown as OrganizationAnnouncement[];
}

export async function loadOrganizationMembers(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_members")
    .select("user_id, role, joined_at, profile:profiles!organization_members_user_id_fkey(handle, display_name)")
    .eq("organization_id", organizationId).limit(300);
  if (error) throw new Error("No se pudieron cargar los miembros.");
  return (data ?? []) as unknown as Array<{
    user_id: string;
    role: OrganizationRole;
    joined_at: string;
    profile: { handle: string; display_name: string };
  }>;
}

export async function loadOrganizationRequests(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_join_requests")
    .select("id, message, created_at, requester_id, requester:profiles!organization_join_requests_requester_id_fkey(handle, display_name)")
    .eq("organization_id", organizationId).eq("status", "pending").order("created_at").limit(100);
  if (error) throw new Error("No se pudieron cargar las solicitudes.");
  return (data ?? []) as unknown as Array<{
    id: string;
    requester_id: string;
    message: string;
    created_at: string;
    requester: { handle: string; display_name: string };
  }>;
}

export function canAdministerOrganization(role: OrganizationRole | null) {
  return role === "owner" || role === "admin";
}
