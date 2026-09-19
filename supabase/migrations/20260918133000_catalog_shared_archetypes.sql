-- A category is useful only when at least two public decks share it. Internal
-- singleton assignments are kept so a future matching deck can reuse the same
-- stable representative and slug.
create or replace view public.archetype_catalog with (security_invoker = true) as
select a.id, a.format, a.name, a.slug, a.description, a.status,
  a.representative_version_id, count(distinct v.deck_id)::integer as deck_count
from public.archetypes a
join public.deck_archetype_assignments membership on membership.archetype_id = a.id
join public.deck_versions v on v.id = membership.deck_version_id
join public.decks d on d.id = v.deck_id and d.current_version = v.version
where d.visibility = 'public' and d.format = a.format
group by a.id
having count(distinct v.deck_id) >= 2;

grant select on public.archetype_catalog to anon, authenticated;
