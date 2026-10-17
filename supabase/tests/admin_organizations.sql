-- Administrative organization-management integration checks. All changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/admin_organizations.sql
begin;

insert into auth.users(id, email, email_confirmed_at) values
  ('a1200000-0000-4000-8000-000000000001', 'admin-organizations@integration.invalid', now()),
  ('b2300000-0000-4000-8000-000000000002', 'owner-organizations@integration.invalid', now()),
  ('c3400000-0000-4000-8000-000000000003', 'member-organizations@integration.invalid', now());

insert into public.user_roles(user_id, role, granted_by)
values ('a1200000-0000-4000-8000-000000000001', 'admin', 'a1200000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'c3400000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.get_admin_organizations('', 'all', 'all', 30, 0);
  exception when others then blocked := sqlerrm = 'Admin access required';
  end;
  if not blocked then raise exception 'A member listed administrative organization data'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'a1200000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare organization_id uuid;
begin
  organization_id := public.admin_create_organization(
    'b2300000-0000-4000-8000-000000000002', 'Integration League', 'integration-league',
    'league', 'public', 'Initial description', null, 'Barcelona', array['commander']
  );
  perform public.admin_update_organization(
    organization_id, 'Integration League Revised', 'club', 'private',
    'Revised description', 'https://example.invalid', 'Girona', array['modern']
  );
  perform public.admin_add_organization_owner(organization_id, 'c3400000-0000-4000-8000-000000000003');
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'b2300000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into public.organization_forum_topics(organization_id, author_id, title, body)
select id, 'b2300000-0000-4000-8000-000000000002', 'Existing activity', 'This topic blocks physical deletion.'
from public.organizations where slug = 'integration-league';
reset role;

select set_config('request.jwt.claim.sub', 'a1200000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  organization_id uuid;
  empty_id uuid;
  blocked boolean := false;
begin
  select id into organization_id from public.organizations where slug = 'integration-league';
  perform public.admin_set_organization_archived(organization_id, true, 'Integration archive check');
  begin
    perform public.delete_empty_organization(organization_id);
  exception when others then blocked := sqlerrm = 'Organization still has activity';
  end;
  if not blocked then raise exception 'An organization with activity was physically deleted'; end if;

  empty_id := public.admin_create_organization(
    'b2300000-0000-4000-8000-000000000002', 'Empty Organization', 'empty-organization',
    'community', 'public', '', null, null, array[]::text[]
  );
  perform public.admin_set_organization_archived(empty_id, true, 'No longer needed');
  perform public.delete_empty_organization(empty_id);
  if exists (select 1 from public.organizations where id = empty_id) then
    raise exception 'An archived empty organization was not deleted';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'b2300000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare affected integer;
begin
  insert into public.organization_forum_topics(organization_id, author_id, title, body)
  select id, 'b2300000-0000-4000-8000-000000000002', 'Forbidden topic', 'Archived organizations reject writes.'
  from public.organizations where slug = 'integration-league';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'A member wrote into an archived organization'; end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.organizations
    where slug = 'integration-league' and name = 'Integration League Revised'
      and kind = 'club' and access = 'private' and archived_at is not null
  ) then raise exception 'Administrative organization changes were not stored'; end if;
  if (select count(*) from public.organization_members membership
      join public.organizations organization on organization.id = membership.organization_id
      where organization.slug = 'integration-league' and membership.role = 'owner') <> 2 then
    raise exception 'The additional owner was not stored';
  end if;
  if not exists (
    select 1 from public.admin_organization_audit_log audit
    where audit.action = 'organization_deleted'
  ) then raise exception 'The deletion audit did not survive'; end if;
  raise notice 'Admin organization assertions passed';
end;
$$;

rollback;
