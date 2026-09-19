-- Role and archetype-admin integration checks. All changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/admin_roles.sql
begin;

insert into auth.users(id, email) values
  ('ad000000-0000-4000-8000-000000000001', 'admin-role@integration.invalid'),
  ('be000000-0000-4000-8000-000000000002', 'member-role@integration.invalid');
insert into public.user_roles(user_id, role, granted_by)
values('ad000000-0000-4000-8000-000000000001', 'admin', 'ad000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'be000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare
  target_archetype uuid;
  affected integer;
begin
  if public.is_admin() then
    raise exception 'A regular member was treated as admin';
  end if;
  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT') then
    raise exception 'Authenticated users can grant roles';
  end if;

  select id into target_archetype
  from public.archetypes
  order by created_at
  limit 1;
  if target_archetype is null then
    raise exception 'No archetype fixture available';
  end if;
  update public.archetypes set description = 'Forbidden edit' where id = target_archetype;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'A regular member edited an archetype';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'ad000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  target_archetype uuid;
  affected integer;
begin
  if not public.is_admin() then
    raise exception 'Admin role was not detected';
  end if;
  select id into target_archetype from public.archetypes order by created_at limit 1;
  update public.archetypes
  set description = 'Admin integration edit', status = 'reviewed'
  where id = target_archetype;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Admin could not edit an archetype';
  end if;
end;
$$;
reset role;

do $$
declare
  target_archetype uuid;
begin
  select id into target_archetype from public.archetypes order by created_at limit 1;
  if not exists (
    select 1 from public.archetypes
    where id = target_archetype
      and description = 'Admin integration edit'
      and status = 'reviewed'
      and updated_by = 'ad000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Archetype audit metadata was not recorded';
  end if;

  raise notice 'Admin role assertions passed';
end;
$$;

rollback;
