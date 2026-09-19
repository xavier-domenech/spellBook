-- Archetypes belong to a format. Membership uses current public versions only.
create table public.archetypes (
  id uuid primary key default gen_random_uuid(),
  format text not null check (format in ('commander', 'standard', 'modern', 'pioneer')),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  description text not null default '',
  status text not null default 'provisional' check (status in ('provisional', 'reviewed')),
  representative_version_id uuid not null references public.deck_versions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (format, slug)
);

create table public.deck_archetype_assignments (
  deck_version_id uuid primary key references public.deck_versions(id) on delete cascade,
  archetype_id uuid not null references public.archetypes(id) on delete cascade,
  similarity numeric not null check (similarity >= 0.9 and similarity <= 1),
  algorithm_version integer not null default 1,
  classified_at timestamptz not null default now()
);
create index deck_archetype_assignments_archetype_idx on public.deck_archetype_assignments(archetype_id);

-- Oracle identities aggregate different printings. Missing identities remain unclassified.
create view public.deck_classification_candidates with (security_invoker = true) as
with normalized as (
  select v.id as version_id, c.zone, c.oracle_id, sum(c.quantity)::integer as quantity
  from public.decks d
  join public.deck_versions v on v.deck_id = d.id and v.version = d.current_version
  join public.deck_cards c on c.deck_version_id = v.id
  where d.visibility = 'public' and (c.zone = 'mainboard' or (d.format = 'commander' and c.zone = 'commander'))
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
where s.resolved and (
  (d.format <> 'commander' and s.main_count >= 60)
  or (d.format = 'commander' and s.main_count + s.commander_count = 100 and s.commander_count between 1 and 2)
);

create function public.deck_card_similarity(a jsonb, b jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select coalesce(
    2.0 * (select coalesce(sum(least(x.value::integer, y.value::integer)), 0)
      from jsonb_each_text(a) x join jsonb_each_text(b) y using (key))
    / nullif((select coalesce(sum(value::integer), 0) from jsonb_each_text(a))
           + (select coalesce(sum(value::integer), 0) from jsonb_each_text(b)), 0), 0);
$$;

-- Only these internal functions may write classifications. No user-supplied label
-- or assignment is trusted. A format-scoped comparison is mandatory.
create function public.refresh_deck_archetypes()
returns void language plpgsql security definer set search_path = '' as $$
declare
  candidate record;
  chosen_id uuid;
  chosen_score numeric;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(719218130);
  delete from public.deck_archetype_assignments;

  for candidate in select * from public.deck_classification_candidates order by created_at, deck_id loop
    chosen_id := null;
    select a.id, score.similarity into chosen_id, chosen_score
    from public.archetypes a
    join public.deck_classification_candidates reference on reference.version_id = a.representative_version_id
      and reference.format = a.format
    cross join lateral (
      select (
        public.deck_card_similarity(candidate.main_cards, reference.main_cards)
          * (candidate.main_count + reference.main_count)
        + 2 * candidate.commander_count
      ) / (candidate.main_count + reference.main_count + candidate.commander_count + reference.commander_count) as similarity
    ) score
    where a.format = candidate.format
      and candidate.commander_cards = reference.commander_cards
      and score.similarity >= 0.9
    order by score.similarity desc, a.created_at, a.id
    limit 1;

    if chosen_id is null then
      new_id := gen_random_uuid();
      insert into public.archetypes(id, format, name, slug, representative_version_id)
      values (new_id, candidate.format, candidate.title,
        'grupo-' || new_id::text, candidate.version_id);
      chosen_id := new_id;
      chosen_score := 1;
    end if;

    insert into public.deck_archetype_assignments(deck_version_id, archetype_id, similarity)
    values (candidate.version_id, chosen_id, chosen_score);
  end loop;
end;
$$;

create function public.refresh_deck_archetypes_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_deck_archetypes();
  return null;
end;
$$;

-- Statement triggers see the entire card batch, not a half-inserted deck.
create trigger classify_deck_cards after insert or update or delete on public.deck_cards
for each statement execute function public.refresh_deck_archetypes_trigger();
create trigger classify_deck_changes after update or delete on public.decks
for each statement execute function public.refresh_deck_archetypes_trigger();
create trigger classify_deck_versions after insert or update or delete on public.deck_versions
for each statement execute function public.refresh_deck_archetypes_trigger();

alter table public.archetypes enable row level security;
alter table public.deck_archetype_assignments enable row level security;

create policy "only active public archetypes are visible" on public.archetypes for select using (
  exists (select 1 from public.deck_classification_candidates c
    where c.version_id = representative_version_id and c.format = archetypes.format)
);
create policy "only current public assignments are visible" on public.deck_archetype_assignments for select using (
  exists (select 1 from public.deck_classification_candidates c
    join public.archetypes a on a.id = archetype_id and a.format = c.format
    where c.version_id = deck_version_id)
);

revoke all on public.archetypes, public.deck_archetype_assignments from anon, authenticated;
grant select on public.archetypes, public.deck_archetype_assignments, public.deck_classification_candidates to anon, authenticated;
revoke all on function public.refresh_deck_archetypes() from public, anon, authenticated;
revoke all on function public.refresh_deck_archetypes_trigger() from public, anon, authenticated;

create view public.archetype_catalog with (security_invoker = true) as
select a.id, a.format, a.name, a.slug, a.description, a.status,
  a.representative_version_id, count(distinct v.deck_id)::integer as deck_count
from public.archetypes a
join public.deck_archetype_assignments membership on membership.archetype_id = a.id
join public.deck_versions v on v.id = membership.deck_version_id
join public.decks d on d.id = v.deck_id and d.current_version = v.version
where d.visibility = 'public' and d.format = a.format
group by a.id;
grant select on public.archetype_catalog to anon, authenticated;

-- Aggregate in SQL so PostgREST row limits never truncate card totals.
create view public.deck_library with (security_invoker = true) as
select d.id, d.title, d.format, d.description, d.visibility, d.current_version,
  d.updated_at, p.handle, p.display_name, v.id as version_id,
  coalesce(sum(c.quantity), 0)::integer as total_cards,
  (array_agg(c.image_small_url order by case when c.zone = 'commander' then 0 else 1 end, c.card_name)
    filter (where c.image_small_url is not null))[1] as cover_url,
  a.id as archetype_id, a.name as archetype_name, a.slug as archetype_slug,
  membership.similarity
from public.decks d
join public.profiles p on p.id = d.owner_id
left join public.deck_versions v on v.deck_id = d.id and v.version = d.current_version
left join public.deck_cards c on c.deck_version_id = v.id
left join public.deck_archetype_assignments membership on membership.deck_version_id = v.id
left join public.archetype_catalog a on a.id = membership.archetype_id and a.format = d.format
group by d.id, p.id, v.id, a.id, a.name, a.slug, membership.similarity;
grant select on public.deck_library to anon, authenticated;

-- Backfill complete lists only; existing demo drafts are preserved.
select public.refresh_deck_archetypes();
