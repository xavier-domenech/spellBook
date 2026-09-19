-- Roles are separate from public profiles so users can never promote themselves
-- through the existing profile update policy. More roles can be added later.
create type public.app_role as enum ('admin');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;

create function public.has_role(requested_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles membership
    where membership.user_id = (select auth.uid())
      and membership.role = requested_role
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin'::public.app_role);
$$;

revoke all on function public.has_role(public.app_role) from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Keep a small audit trail on content managed from the admin area.
alter table public.archetypes
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references auth.users(id) on delete set null,
  add constraint archetypes_description_length check (char_length(description) <= 1000);

create function public.stamp_archetype_admin_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

create trigger archetypes_stamp_admin_update
before update of name, slug, description, status on public.archetypes
for each row execute function public.stamp_archetype_admin_update();

create policy "admins view every archetype"
on public.archetypes for select to authenticated
using ((select public.has_role('admin'::public.app_role)));

create policy "admins manage archetype metadata"
on public.archetypes for update to authenticated
using ((select public.has_role('admin'::public.app_role)))
with check ((select public.has_role('admin'::public.app_role)));

grant update (name, slug, description, status) on public.archetypes to authenticated;

revoke all on function public.stamp_archetype_admin_update() from public, anon, authenticated;

-- Promote an existing local xavidp account when this migration is applied to
-- an already populated database. The seed handles clean resets.
insert into public.user_roles (user_id, role, granted_by)
select profile.id, 'admin'::public.app_role, profile.id
from public.profiles profile
where profile.handle = 'xavidp'
on conflict do nothing;
