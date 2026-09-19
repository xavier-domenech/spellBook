-- Archetypes should include meaningful variants, not only near-identical
-- lists. Eighty percent keeps a 12-card variation window in a 60-card deck.
alter table public.deck_archetype_assignments
drop constraint deck_archetype_assignments_similarity_check;

alter table public.deck_archetype_assignments
add constraint deck_archetype_assignments_similarity_check
check (similarity >= 0.8 and similarity <= 1);

create or replace function public.refresh_deck_archetypes()
returns void language plpgsql security definer set search_path = '' as $$
declare
  candidate record;
  chosen_id uuid;
  chosen_score numeric;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(719218130);
  delete from public.deck_archetype_assignments
  where deck_version_id is not null;

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
      and score.similarity >= 0.8
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

revoke all on function public.refresh_deck_archetypes() from public, anon, authenticated;

-- Existing singleton representatives would always prefer themselves at score
-- 1. Rebuild provisional groups once so the new threshold can merge them.
delete from public.deck_archetype_assignments
where deck_version_id is not null;

delete from public.archetypes
where status = 'provisional';

select public.refresh_deck_archetypes();
