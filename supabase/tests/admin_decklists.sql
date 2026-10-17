-- Administrative decklist-management integration checks. All changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/admin_decklists.sql
begin;

insert into auth.users(id, email, email_confirmed_at) values
  ('a1400000-0000-4000-8000-000000000001', 'admin-decks@integration.invalid', now()),
  ('b2500000-0000-4000-8000-000000000002', 'owner-decks@integration.invalid', now()),
  ('c3600000-0000-4000-8000-000000000003', 'member-decks@integration.invalid', now());

insert into public.user_roles(user_id, role, granted_by)
values ('a1400000-0000-4000-8000-000000000001', 'admin', 'a1400000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'c3600000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.get_admin_decks('', 'all', 'all', 30, 0);
  exception when others then blocked := sqlerrm = 'Admin access required';
  end;
  if not blocked then raise exception 'A member listed administrative deck data'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'a1400000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  created_deck_id uuid;
  disposable_deck_id uuid;
  new_version integer;
  listed integer;
  blocked boolean := false;
  cards jsonb := jsonb_build_array(jsonb_build_object(
    'zone', 'mainboard', 'quantity', 60,
    'oracle_id', '11111111-1111-4111-8111-111111111111',
    'scryfall_id', '22222222-2222-4222-8222-222222222222',
    'card_name', 'Forest', 'image_small_url', null, 'image_normal_url', null
  ));
begin
  created_deck_id := public.admin_create_deck(
    'b2500000-0000-4000-8000-000000000002', 'Integration Deck', 'standard',
    'public', 'Created by an administrator', 'Version one', cards
  );
  select count(*) into listed from public.get_admin_decks('Integration Deck', 'standard', 'active', 30, 0)
  where id = created_deck_id and owner_id = 'b2500000-0000-4000-8000-000000000002';
  if listed <> 1 then raise exception 'Admin deck listing did not return the created deck'; end if;

  cards := jsonb_set(cards, '{0,quantity}', '61'::jsonb);
  new_version := public.admin_create_deck_version(created_deck_id, 'Version two', cards);
  if new_version <> 2 then raise exception 'New deck version was not sequential'; end if;
  if (select sum(card.quantity) from public.deck_cards card join public.deck_versions version on version.id = card.deck_version_id where version.deck_id = created_deck_id and version.version = 1) <> 60 then
    raise exception 'Publishing a version mutated the previous version';
  end if;

  perform public.admin_update_deck_metadata(created_deck_id, 'Integration Deck Revised', 'Revised', 'public');
  perform public.admin_transfer_deck(created_deck_id, 'c3600000-0000-4000-8000-000000000003');
  perform public.admin_set_deck_moderation(created_deck_id, true, 'Integration moderation check');
  if exists (select 1 from public.deck_library where id = created_deck_id) then raise exception 'A hidden deck remained in the public library'; end if;
  perform public.admin_set_deck_moderation(created_deck_id, false, '');
  perform public.admin_set_deck_archived(created_deck_id, true, 'Integration archive check');
  if exists (select 1 from public.deck_library where id = created_deck_id) then raise exception 'An archived deck remained in the public library'; end if;
  begin
    perform public.delete_unreferenced_deck(created_deck_id);
  exception when others then blocked := sqlerrm = 'Deck still has references';
  end;
  if not blocked then raise exception 'A referenced deck was physically deleted'; end if;

  disposable_deck_id := public.admin_create_deck(
    'b2500000-0000-4000-8000-000000000002', 'Disposable Deck', 'standard',
    'private', '', '', jsonb_set(cards, '{0,quantity}', '60'::jsonb)
  );
  perform public.admin_set_deck_archived(disposable_deck_id, true, 'No longer needed');
  perform public.delete_unreferenced_deck(disposable_deck_id);
  if exists (select 1 from public.decks where id = disposable_deck_id) then raise exception 'An unreferenced archived deck was not deleted'; end if;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.deck_admin_audit_log) < 8 then
    raise exception 'Administrative deck actions were not audited';
  end if;
  if not exists (select 1 from public.deck_admin_audit_log where action = 'deck_deleted') then
    raise exception 'The deletion audit did not survive';
  end if;
  raise notice 'Admin decklist assertions passed';
end;
$$;

rollback;
