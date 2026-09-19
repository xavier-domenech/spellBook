import Link from "next/link";
import { Bell, ExternalLink, LockKeyhole, MapPin, Megaphone, MessageSquareText, Settings, ShieldCheck, Users } from "lucide-react";
import { canAdministerOrganization, organizationKindLabels, organizationRoleLabels, type OrganizationContext } from "@/features/organizations/data";

type OrganizationHeaderProps = {
  organization: OrganizationContext;
  active: "overview" | "forum" | "announcements" | "members" | "settings";
};

export function OrganizationHeader({ organization, active }: OrganizationHeaderProps) {
  const canAdmin = canAdministerOrganization(organization.viewerRole);
  const canSeeMembers = organization.access === "public" || Boolean(organization.viewerRole);
  const initials = organization.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  const links = [
    { key: "overview", href: `/organizations/${organization.slug}`, label: "Resumen", icon: Bell, visible: true },
    { key: "forum", href: `/organizations/${organization.slug}/forum`, label: "Foro", icon: MessageSquareText, visible: organization.access === "public" || Boolean(organization.viewerRole) },
    { key: "announcements", href: `/organizations/${organization.slug}/announcements`, label: "Anuncios", icon: Megaphone, visible: organization.access === "public" || Boolean(organization.viewerRole) },
    { key: "members", href: `/organizations/${organization.slug}/members`, label: "Miembros", icon: Users, visible: canSeeMembers },
    { key: "settings", href: `/organizations/${organization.slug}/settings`, label: "Configurar", icon: Settings, visible: canAdmin },
  ] as const;

  return (
    <>
      <header className="organization-hero">
        <div className="organization-avatar">{initials}</div>
        <div className="organization-hero-copy">
          <div className="organization-badges">
            <span>{organizationKindLabels[organization.kind]}</span>
            <span>{organization.access === "public" ? "Pública" : <><LockKeyhole size={12} /> Privada</>}</span>
            {organization.viewerRole && <span><ShieldCheck size={12} /> {organizationRoleLabels[organization.viewerRole]}</span>}
          </div>
          <h1>{organization.name}</h1>
          <p>{organization.description || "Esta organización todavía no ha añadido una descripción."}</p>
          <div className="organization-meta">
            {organization.location && <span><MapPin size={14} /> {organization.location}</span>}
            {organization.website_url && <Link href={organization.website_url} rel="noreferrer" target="_blank"><ExternalLink size={14} /> Sitio web</Link>}
            <span><Users size={14} /> {organization.members[0]?.count ?? 0} miembros</span>
          </div>
        </div>
      </header>
      <nav aria-label="Secciones de la organización" className="organization-nav">
        {links.filter((link) => link.visible).map(({ key, href, label, icon: Icon }) => (
          <Link className={active === key ? "active" : ""} href={href} key={key}><Icon size={15} /> {label}</Link>
        ))}
      </nav>
    </>
  );
}
