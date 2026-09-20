-- Formats become an administrable catalog. Existing slugs stay stable so this
-- migration remains compatible with already deployed application versions.
create table public.formats (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 50),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  rules_summary text not null default '' check (char_length(rules_summary) <= 200),
  mainboard_min smallint not null check (mainboard_min between 0 and 500),
  mainboard_max smallint check (mainboard_max between 0 and 500 and mainboard_max >= mainboard_min),
  commander_min smallint not null default 0 check (commander_min between 0 and 10),
  commander_max smallint not null default 0 check (commander_max between commander_min and 10),
  total_min smallint not null check (total_min between 1 and 500),
  total_max smallint check (total_max between 1 and 500 and total_max >= total_min),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (total_min >= mainboard_min + commander_min),
  check (total_max is null or mainboard_max is null or total_max <= mainboard_max + commander_max)
);

insert into public.formats (
  slug, name, description, rules_summary,
  mainboard_min, mainboard_max, commander_min, commander_max, total_min, total_max, sort_order
)
values
  ('commander', 'Commander', 'Encuentra listas alrededor de tu comandante y descubre nuevas construcciones.', '100 cartas, comandante incluido', 98, 99, 1, 2, 100, 100, 10),
  ('standard', 'Standard', 'Descubre las construcciones de la comunidad en el formato rotativo.', 'Mínimo 60 cartas principales', 60, null, 0, 0, 60, null, 20),
  ('modern', 'Modern', 'Explora estrategias, variantes y listas de Modern.', 'Mínimo 60 cartas principales', 60, null, 0, 0, 60, null, 30),
  ('pioneer', 'Pioneer', 'Comparte tus ideas y encuentra otras versiones de tu estrategia en Pioneer.', 'Mínimo 60 cartas principales', 60, null, 0, 0, 60, null, 40);

alter table public.decks drop constraint if exists decks_format_check;
alter table public.decks
  add constraint decks_format_fkey foreign key (format) references public.formats(slug) on update restrict on delete restrict;

alter table public.archetypes drop constraint if exists archetypes_format_check;
alter table public.archetypes
  add constraint archetypes_format_fkey foreign key (format) references public.formats(slug) on update restrict on delete restrict;

alter table public.organizations drop constraint if exists organizations_formats_check;
alter table public.organizations drop constraint if exists organizations_formats_check1;
alter table public.organizations
  add constraint organizations_formats_limit check (cardinality(formats) <= 8);

alter table public.profiles
  add constraint profiles_favorite_formats_limit check (cardinality(favorite_formats) <= 8);

-- Relation tables provide referential integrity while the compatibility arrays
-- remain available to the current public queries.
create table public.profile_formats (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  format_slug text not null references public.formats(slug) on update restrict on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, format_slug)
);

create table public.organization_formats (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  format_slug text not null references public.formats(slug) on update restrict on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, format_slug)
);

insert into public.profile_formats (profile_id, format_slug)
select profile.id, format_slug
from public.profiles profile
cross join lateral unnest(profile.favorite_formats) as format_slug;

insert into public.organization_formats (organization_id, format_slug)
select organization.id, format_slug
from public.organizations organization
cross join lateral unnest(organization.formats) as format_slug;

create function public.sync_profile_formats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(new.favorite_formats) <> (
    select count(distinct value) from unnest(new.favorite_formats) as value
  ) then
    raise exception 'Duplicate formats are not allowed';
  end if;

  if exists (
    select 1 from unnest(new.favorite_formats) as requested(slug)
    left join public.formats format on format.slug = requested.slug
    where format.slug is null or not format.is_active
  ) then
    raise exception 'Unknown or archived format';
  end if;

  delete from public.profile_formats where profile_id = new.id;
  insert into public.profile_formats (profile_id, format_slug)
  select new.id, value from unnest(new.favorite_formats) as value;
  return new;
end;
$$;

create trigger profiles_sync_formats
after insert or update of favorite_formats on public.profiles
for each row execute function public.sync_profile_formats();

create function public.sync_organization_formats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(new.formats) <> (
    select count(distinct value) from unnest(new.formats) as value
  ) then
    raise exception 'Duplicate formats are not allowed';
  end if;

  if exists (
    select 1 from unnest(new.formats) as requested(slug)
    left join public.formats format on format.slug = requested.slug
    where format.slug is null or not format.is_active
  ) then
    raise exception 'Unknown or archived format';
  end if;

  delete from public.organization_formats where organization_id = new.id;
  insert into public.organization_formats (organization_id, format_slug)
  select new.id, value from unnest(new.formats) as value;
  return new;
end;
$$;

create trigger organizations_sync_formats
after insert or update of formats on public.organizations
for each row execute function public.sync_organization_formats();

create table public.format_audit_log (
  id bigint generated by default as identity primary key,
  format_slug text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor_id uuid references auth.users(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create function public.manage_format_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.slug <> old.slug then raise exception 'Format slugs cannot be changed'; end if;
    new.updated_at = now();
    new.updated_by = (select auth.uid());
    insert into public.format_audit_log (format_slug, action, actor_id, old_data, new_data)
    values (new.slug, 'updated', (select auth.uid()), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, (select auth.uid()));
    new.updated_by = coalesce(new.updated_by, (select auth.uid()));
    insert into public.format_audit_log (format_slug, action, actor_id, new_data)
    values (new.slug, 'created', (select auth.uid()), to_jsonb(new));
    return new;
  end if;

  insert into public.format_audit_log (format_slug, action, actor_id, old_data)
  values (old.slug, 'deleted', (select auth.uid()), to_jsonb(old));
  return old;
end;
$$;

create trigger formats_audit_insert_update
before insert or update on public.formats
for each row execute function public.manage_format_audit();
create trigger formats_audit_delete
after delete on public.formats
for each row execute function public.manage_format_audit();

alter table public.formats enable row level security;
alter table public.profile_formats enable row level security;
alter table public.organization_formats enable row level security;
alter table public.format_audit_log enable row level security;

create policy "formats are public" on public.formats for select using (true);
create policy "admins create formats" on public.formats for insert to authenticated
with check ((select public.is_admin()));
create policy "admins update formats" on public.formats for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "profile formats are public" on public.profile_formats for select using (true);
create policy "organization formats follow organization visibility" on public.organization_formats for select using (
  exists (select 1 from public.organizations organization where organization.id = organization_id)
);
create policy "admins read format audit" on public.format_audit_log for select to authenticated
using ((select public.is_admin()));

revoke all on public.formats, public.profile_formats, public.organization_formats, public.format_audit_log from anon, authenticated;
grant select on public.formats, public.profile_formats, public.organization_formats to anon, authenticated;
grant select on public.format_audit_log to authenticated;
grant insert (slug, name, description, rules_summary, mainboard_min, mainboard_max,
  commander_min, commander_max, total_min, total_max, sort_order, is_active) on public.formats to authenticated;
grant update (name, description, rules_summary, mainboard_min, mainboard_max,
  commander_min, commander_max, total_min, total_max, sort_order, is_active) on public.formats to authenticated;

create function public.get_admin_formats()
returns table (
  slug text,
  name text,
  description text,
  rules_summary text,
  mainboard_min smallint,
  mainboard_max smallint,
  commander_min smallint,
  commander_max smallint,
  total_min smallint,
  total_max smallint,
  sort_order integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  deck_count bigint,
  archetype_count bigint,
  profile_count bigint,
  organization_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select format.slug, format.name, format.description, format.rules_summary,
    format.mainboard_min, format.mainboard_max, format.commander_min, format.commander_max,
    format.total_min, format.total_max, format.sort_order, format.is_active,
    format.created_at, format.updated_at,
    (select count(*) from public.decks deck where deck.format = format.slug),
    (select count(*) from public.archetypes archetype where archetype.format = format.slug),
    (select count(*) from public.profile_formats preference where preference.format_slug = format.slug),
    (select count(*) from public.organization_formats relation where relation.format_slug = format.slug)
  from public.formats format
  order by format.sort_order, format.name, format.slug;
end;
$$;

create function public.delete_unused_format(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  delete from public.formats where slug = p_slug;
  if not found then raise exception 'Format not found'; end if;
exception
  when foreign_key_violation then raise exception 'Format is in use';
end;
$$;

revoke all on function public.get_admin_formats() from public, anon;
revoke all on function public.delete_unused_format(text) from public, anon;
grant execute on function public.get_admin_formats() to authenticated;
grant execute on function public.delete_unused_format(text) to authenticated;

-- Deck validation now follows catalog rules and rejects archived formats.
create or replace function public.create_deck(
  p_title text,
  p_format text,
  p_visibility public.deck_visibility,
  p_cards jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_deck_id uuid;
  new_version_id uuid;
  mainboard_count integer;
  commander_count integer;
  total_count integer;
  format_rule public.formats%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_array_length(p_cards) = 0 or jsonb_array_length(p_cards) > 500 then
    raise exception 'invalid card count';
  end if;

  select * into format_rule from public.formats where slug = p_format and is_active;
  if not found then raise exception 'unknown or archived format'; end if;

  select
    coalesce(sum((card ->> 'quantity')::integer) filter (where card ->> 'zone' = 'mainboard'), 0),
    coalesce(sum((card ->> 'quantity')::integer) filter (where card ->> 'zone' = 'commander'), 0)
  into mainboard_count, commander_count
  from jsonb_array_elements(p_cards) as card;
  total_count := mainboard_count + commander_count;

  if mainboard_count < format_rule.mainboard_min
    or (format_rule.mainboard_max is not null and mainboard_count > format_rule.mainboard_max)
    or commander_count < format_rule.commander_min
    or commander_count > format_rule.commander_max
    or total_count < format_rule.total_min
    or (format_rule.total_max is not null and total_count > format_rule.total_max) then
    raise exception 'deck does not satisfy format rules';
  end if;

  insert into public.decks (owner_id, title, format, visibility)
  values (auth.uid(), p_title, p_format, p_visibility)
  returning id into new_deck_id;

  insert into public.deck_versions (deck_id, version)
  values (new_deck_id, 1)
  returning id into new_version_id;

  insert into public.deck_cards (
    deck_version_id, zone, quantity, oracle_id, scryfall_id,
    card_name, image_small_url, image_normal_url
  )
  select new_version_id, card.zone::public.deck_zone, card.quantity, card.oracle_id,
    card.scryfall_id, card.card_name, card.image_small_url, card.image_normal_url
  from jsonb_to_recordset(p_cards) as card(
    zone text, quantity smallint, oracle_id uuid, scryfall_id uuid,
    card_name text, image_small_url text, image_normal_url text
  );

  return new_deck_id;
end;
$$;

grant execute on function public.create_deck(text, text, public.deck_visibility, jsonb) to authenticated;

create or replace view public.deck_classification_candidates with (security_invoker = true) as
with normalized as (
  select v.id as version_id, c.zone, c.oracle_id, sum(c.quantity)::integer as quantity
  from public.decks d
  join public.formats f on f.slug = d.format
  join public.deck_versions v on v.deck_id = d.id and v.version = d.current_version
  join public.deck_cards c on c.deck_version_id = v.id
  where d.visibility = 'public' and (c.zone = 'mainboard' or (f.commander_max > 0 and c.zone = 'commander'))
  group by v.id, c.zone, c.oracle_id
), signatures as (
  select version_id,
    coalesce(jsonb_object_agg(oracle_id::text, quantity) filter (where zone = 'mainboard' and oracle_id is not null), '{}'::jsonb) as main_cards,
    coalesce(jsonb_object_agg(oracle_id::text, quantity) filter (where zone = 'commander' and oracle_id is not null), '{}'::jsonb) as commander_cards,
    coalesce(sum(quantity) filter (where zone = 'mainboard'), 0) as main_count,
    coalesce(sum(quantity) filter (where zone = 'commander'), 0) as commander_count,
    bool_and(oracle_id is not null) as resolved
  from normalized group by version_id
)
select d.id as deck_id, v.id as version_id, d.title, d.format, d.created_at,
  s.main_cards, s.commander_cards, s.main_count, s.commander_count
from signatures s
join public.deck_versions v on v.id = s.version_id
join public.decks d on d.id = v.deck_id
join public.formats f on f.slug = d.format
where s.resolved
  and s.main_count >= f.mainboard_min
  and (f.mainboard_max is null or s.main_count <= f.mainboard_max)
  and s.commander_count >= f.commander_min
  and s.commander_count <= f.commander_max
  and s.main_count + s.commander_count >= f.total_min
  and (f.total_max is null or s.main_count + s.commander_count <= f.total_max);

create or replace view public.deck_library with (security_invoker = true) as
select d.id, d.title, d.format, d.description, d.visibility, d.current_version,
  d.updated_at, p.handle, p.display_name, v.id as version_id,
  coalesce(sum(c.quantity), 0)::integer as total_cards,
  (array_agg(c.image_small_url order by case when c.zone = 'commander' then 0 else 1 end, c.card_name)
    filter (where c.image_small_url is not null))[1] as cover_url,
  a.id as archetype_id, a.name as archetype_name, a.slug as archetype_slug,
  membership.similarity, f.name as format_name
from public.decks d
join public.formats f on f.slug = d.format
join public.profiles p on p.id = d.owner_id
left join public.deck_versions v on v.deck_id = d.id and v.version = d.current_version
left join public.deck_cards c on c.deck_version_id = v.id
left join public.deck_archetype_assignments membership on membership.deck_version_id = v.id
left join public.archetype_catalog a on a.id = membership.archetype_id and a.format = d.format
group by d.id, p.id, v.id, a.id, a.name, a.slug, membership.similarity, f.name;

grant select on public.deck_classification_candidates, public.deck_library to anon, authenticated;

create function public.refresh_archetypes_after_format_rule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_deck_archetypes();
  return null;
end;
$$;

create trigger formats_refresh_archetypes
after update of mainboard_min, mainboard_max, commander_min, commander_max, total_min, total_max on public.formats
for each row
when (
  (old.mainboard_min, old.mainboard_max, old.commander_min, old.commander_max, old.total_min, old.total_max)
  is distinct from
  (new.mainboard_min, new.mainboard_max, new.commander_min, new.commander_max, new.total_min, new.total_max)
)
execute function public.refresh_archetypes_after_format_rule_change();

revoke all on function public.sync_profile_formats() from public, anon, authenticated;
revoke all on function public.sync_organization_formats() from public, anon, authenticated;
revoke all on function public.manage_format_audit() from public, anon, authenticated;
revoke all on function public.refresh_archetypes_after_format_rule_change() from public, anon, authenticated;
