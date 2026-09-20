-- Administrative user-management integration checks. All changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/admin_users.sql
begin;

insert into auth.users(id, email, email_confirmed_at) values
  ('a1100000-0000-4000-8000-000000000001', 'admin-users@integration.invalid', now()),
  ('b2200000-0000-4000-8000-000000000002', 'target-users@integration.invalid', now()),
  ('c3300000-0000-4000-8000-000000000003', 'member-users@integration.invalid', now());

insert into public.user_roles(user_id, role, granted_by)
values ('a1100000-0000-4000-8000-000000000001', 'admin', 'a1100000-0000-4000-8000-000000000001');

insert into public.posts(author_id, content)
values ('b2200000-0000-4000-8000-000000000002', 'Dependent content');

select set_config('request.jwt.claim.sub', 'c3300000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.get_admin_users('', 'all', 30, 0);
  exception when others then
    blocked := sqlerrm = 'Admin access required';
  end;
  if not blocked then raise exception 'A member listed administrative user data'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'a1100000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  listed integer;
  blocked boolean := false;
begin
  select count(*) into listed
  from public.get_admin_users('target-users', 'active', 30, 0)
  where id = 'b2200000-0000-4000-8000-000000000002';
  if listed <> 1 then raise exception 'Admin user listing did not return the target'; end if;

  perform public.admin_update_user_profile(
    'b2200000-0000-4000-8000-000000000002',
    'target_admin_test',
    'Target revised',
    'Profile updated by integration test'
  );
  perform public.admin_set_user_role('b2200000-0000-4000-8000-000000000002', true);
  perform public.admin_set_user_state(
    'b2200000-0000-4000-8000-000000000002',
    'suspended',
    'Integration moderation check'
  );

  begin
    perform public.admin_assert_user_deletable('b2200000-0000-4000-8000-000000000002');
  exception when others then
    blocked := sqlerrm = 'User still owns content';
  end;
  if not blocked then raise exception 'A user with content was deletable'; end if;

  perform public.admin_set_user_role('b2200000-0000-4000-8000-000000000002', false);
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = 'b2200000-0000-4000-8000-000000000002'
      and handle = 'target_admin_test'
      and display_name = 'Target revised'
  ) then raise exception 'Administrative profile update was not stored'; end if;

  if not exists (
    select 1 from public.user_admin_state
    where user_id = 'b2200000-0000-4000-8000-000000000002'
      and status = 'suspended'
  ) then raise exception 'Suspension state was not stored'; end if;

  if (select count(*) from public.admin_user_audit_log
      where target_user_id = 'b2200000-0000-4000-8000-000000000002') < 4 then
    raise exception 'Administrative user actions were not audited';
  end if;

  raise notice 'Admin user assertions passed';
end;
$$;

rollback;
