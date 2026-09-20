-- Dynamic format catalog, RLS and deletion checks. All changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/admin_formats.sql
begin;

insert into auth.users(id, email, raw_user_meta_data) values
  ('fa000000-0000-4000-8000-000000000001', 'format-admin@integration.invalid', '{"display_name":"format_admin"}'),
  ('fb000000-0000-4000-8000-000000000002', 'format-member@integration.invalid', '{"display_name":"format_member"}');
insert into public.user_roles(user_id, role, granted_by)
values('fa000000-0000-4000-8000-000000000001', 'admin', 'fa000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'fb000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.formats (
      slug, name, rules_summary, mainboard_min, commander_min, commander_max, total_min
    ) values ('forbidden-format', 'Forbidden', 'Forbidden', 60, 0, 0, 60);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'A regular user created a format'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into public.formats (
  slug, name, description, rules_summary, mainboard_min, commander_min,
  commander_max, total_min, sort_order
) values ('pauper-test', 'Pauper test', 'Integration fixture', 'At least 60 cards', 60, 0, 0, 60, 90);

do $$
begin
  if not exists (select 1 from public.get_admin_formats() where slug = 'pauper-test') then
    raise exception 'Admin catalog did not return the new format';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'fb000000-0000-4000-8000-000000000002', true);
set local role authenticated;
update public.profiles set favorite_formats = array['pauper-test'] where id = auth.uid();
do $$
declare
  deck_id uuid;
  blocked boolean := false;
  cards jsonb := jsonb_build_array(jsonb_build_object(
    'zone', 'mainboard', 'quantity', 60, 'oracle_id', null,
    'scryfall_id', 'fc000000-0000-4000-8000-000000000003',
    'card_name', 'Integration card', 'image_small_url', null, 'image_normal_url', null
  ));
begin
  if not exists (
    select 1 from public.profile_formats
    where profile_id = auth.uid() and format_slug = 'pauper-test'
  ) then raise exception 'Profile format relation was not synchronized'; end if;

  begin
    perform public.create_deck(
      'Invalid dynamic format deck', 'pauper-test', 'private',
      jsonb_set(cards, '{0,quantity}', '59'::jsonb)
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Dynamic format rules accepted an undersized deck'; end if;

  deck_id := public.create_deck('Valid dynamic format deck', 'pauper-test', 'private', cards);
  if deck_id is null then raise exception 'Dynamic format rejected a valid deck'; end if;
  delete from public.decks where id = deck_id;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000001', true);
set local role authenticated;
update public.formats set is_active = false where slug = 'pauper-test';
do $$
declare blocked boolean := false;
begin
  begin
    perform public.delete_unused_format('pauper-test');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'A referenced format was deleted'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'fb000000-0000-4000-8000-000000000002', true);
set local role authenticated;
update public.profiles set favorite_formats = '{}' where id = auth.uid();
do $$
declare blocked boolean := false;
begin
  begin
    update public.profiles set favorite_formats = array['pauper-test'] where id = auth.uid();
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'An archived format was selected'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.delete_unused_format('pauper-test');
reset role;

do $$
begin
  if exists (select 1 from public.formats where slug = 'pauper-test') then
    raise exception 'Unused format was not deleted';
  end if;
  if not exists (
    select 1 from public.format_audit_log
    where format_slug = 'pauper-test' and action = 'deleted'
  ) then raise exception 'Format deletion was not audited'; end if;
  raise notice 'Admin format assertions passed';
end;
$$;

rollback;
