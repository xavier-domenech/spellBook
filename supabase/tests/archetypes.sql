-- Integration checks; all fixtures and classification changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/archetypes.sql
begin;

create function pg_temp.test_card(identity_id uuid, copies integer, card_zone text default 'mainboard')
returns jsonb language sql as $$
  select jsonb_build_object('zone', card_zone, 'quantity', copies,
    'oracle_id', identity_id, 'scryfall_id', gen_random_uuid(), 'card_name', 'Integration fixture');
$$;

-- Exercise the same API role that PostgREST uses. Supabase enables safe-update
-- protection for this role, so unqualified maintenance deletes fail here.
insert into auth.users(id, email)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'authenticated-role@integration.invalid');
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);
set local role authenticated;
select public.create_deck('Authenticated role fixture', 'modern', 'private',
  jsonb_build_array(pg_temp.test_card('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 60)));
reset role;

do $$
declare
  actor uuid := gen_random_uuid();
  card_a uuid := gen_random_uuid();
  card_b uuid := gen_random_uuid();
  card_c uuid := gen_random_uuid();
  card_d uuid := gen_random_uuid();
  leader uuid := gen_random_uuid();
  other_leader uuid := gen_random_uuid();
  base uuid;
  near_deck uuid;
  far_deck uuid;
  other_format uuid;
  different_print uuid;
  commander_base uuid;
  commander_other uuid;
  group_id uuid;
  count_before integer;
  blocked boolean;
begin
  insert into auth.users(id, email) values(actor, actor::text || '@integration.invalid');
  perform set_config('request.jwt.claim.sub', actor::text, true);
  select count(*) into count_before from public.decks;

  -- Size guard must work even when bypassing the HTTP endpoint.
  blocked := false;
  begin
    perform public.create_deck('Invalid fixture', 'modern', 'public',
      jsonb_build_array(pg_temp.test_card(card_a, 59), pg_temp.test_card(card_b, 15, 'sideboard')));
  exception when raise_exception then blocked := true;
  end;
  if not blocked or (select count(*) from public.decks) <> count_before then
    raise exception 'Invalid deck was saved or partial data leaked';
  end if;
  blocked := false;
  begin
    perform public.create_deck('Invalid Commander fixture', 'commander', 'public',
      jsonb_build_array(pg_temp.test_card(card_a, 100), pg_temp.test_card(leader, 1, 'commander')));
  exception when raise_exception then blocked := true;
  end;
  if not blocked then raise exception '101-card Commander was accepted'; end if;

  base := public.create_deck('Fixture Burn', 'modern', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 48), pg_temp.test_card(card_b, 12)));
  update public.decks set created_at = '2000-01-01 00:00:00+00' where id = base;
  select membership.archetype_id into group_id from public.deck_archetype_assignments membership
    join public.deck_versions v on v.id = membership.deck_version_id where v.deck_id = base;
  if group_id is null then raise exception 'Complete deck was not classified'; end if;

  near_deck := public.create_deck('Fixture 80 percent', 'modern', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 48), pg_temp.test_card(card_c, 12), pg_temp.test_card(card_d, 15, 'sideboard')));
  update public.decks set created_at = '2000-01-02 00:00:00+00' where id = near_deck;
  if not exists (select 1 from public.deck_archetype_assignments m join public.deck_versions v on v.id = m.deck_version_id
    where v.deck_id = near_deck and m.archetype_id = group_id and m.similarity = 0.8) then
    raise exception 'Exact 80 percent match or sideboard exclusion failed';
  end if;

  -- Close to the second deck, but not the fixed anchor: do not chain groups.
  far_deck := public.create_deck('Fixture chain', 'modern', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 36), pg_temp.test_card(card_c, 24)));
  update public.decks set created_at = '2000-01-03 00:00:00+00' where id = far_deck;
  if exists (select 1 from public.deck_archetype_assignments m join public.deck_versions v on v.id = m.deck_version_id
    where v.deck_id = far_deck and m.archetype_id = group_id) then
    raise exception 'Transitive similarity incorrectly merged groups';
  end if;
  if exists (select 1 from public.archetype_catalog a
    join public.deck_archetype_assignments m on m.archetype_id = a.id
    join public.deck_versions v on v.id = m.deck_version_id
    where v.deck_id = far_deck) then
    raise exception 'Singleton classification was exposed as an archetype';
  end if;

  different_print := public.create_deck('Fixture editions', 'modern', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 24), pg_temp.test_card(card_a, 24), pg_temp.test_card(card_b, 12)));
  if not exists (select 1 from public.deck_archetype_assignments m join public.deck_versions v on v.id = m.deck_version_id
    where v.deck_id = different_print and m.archetype_id = group_id and m.similarity = 1) then
    raise exception 'Printings were not aggregated by Oracle ID';
  end if;

  other_format := public.create_deck('Fixture Burn', 'standard', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 48), pg_temp.test_card(card_b, 12)));
  if exists (select 1 from public.deck_archetype_assignments m join public.deck_versions v on v.id = m.deck_version_id
    where v.deck_id = other_format and m.archetype_id = group_id) then
    raise exception 'Formats were mixed';
  end if;
  -- Same slug and name are allowed in separate formats.
  update public.archetypes set slug = 'fixture-burn' where id = group_id;
  update public.archetypes set slug = 'fixture-burn' where representative_version_id in
    (select id from public.deck_versions where deck_id = other_format);

  commander_base := public.create_deck('Fixture Commander A', 'commander', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 99), pg_temp.test_card(leader, 1, 'commander')));
  commander_other := public.create_deck('Fixture Commander B', 'commander', 'public',
    jsonb_build_array(pg_temp.test_card(card_a, 99), pg_temp.test_card(other_leader, 1, 'commander')));
  if (select m.archetype_id from public.deck_archetype_assignments m join public.deck_versions v on v.id=m.deck_version_id where v.deck_id=commander_base)
    = (select m.archetype_id from public.deck_archetype_assignments m join public.deck_versions v on v.id=m.deck_version_id where v.deck_id=commander_other) then
    raise exception 'Different commanders merged';
  end if;

  update public.decks set visibility = 'private' where id = base;
  if exists (select 1 from public.deck_archetype_assignments m join public.deck_versions v on v.id=m.deck_version_id where v.deck_id=base)
    or exists (select 1 from public.archetype_catalog where id=group_id) then
    raise exception 'Private reference leaked through classification';
  end if;
  update public.decks set visibility = 'unlisted' where id = other_format;
  if exists (select 1 from public.deck_archetype_assignments m join public.deck_versions v on v.id=m.deck_version_id where v.deck_id=other_format) then
    raise exception 'Unlisted deck included in public classification';
  end if;

  if has_function_privilege('authenticated', 'public.refresh_deck_archetypes()', 'EXECUTE') then
    raise exception 'Users can call internal classification maintenance';
  end if;
  if has_table_privilege('authenticated', 'public.deck_archetype_assignments', 'INSERT') then
    raise exception 'Users can forge assignments';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'Classification assertions passed';
end;
$$;

set local role anon;
do $$
begin
  -- Exercise the full RLS view chain, not just privileged SQL queries.
  if not exists (select 1 from public.archetype_catalog where name like 'Fixture%') then
    raise exception 'Public catalogue hidden or broken under RLS';
  end if;
  if exists (select 1 from public.deck_library where title='Fixture Burn' and visibility <> 'public') then
    -- Unlisted decks are intentionally link-readable under existing RLS. The
    -- public library must always add visibility=public (as loadLibrary does).
    if exists (select 1 from public.deck_library where title='Fixture Burn' and visibility='private') then
      raise exception 'Private deck leaked to anonymous readers';
    end if;
  end if;
  if exists (select 1 from public.archetypes where slug='fixture-burn') then
    raise exception 'Private or unlisted reference name leaked to anonymous readers';
  end if;
end;
$$;
reset role;
rollback;
