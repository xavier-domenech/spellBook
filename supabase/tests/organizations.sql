-- Organization membership, permissions and content checks. All changes are rolled back.
-- docker exec -i supabase_db_magicSocial psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/tests/organizations.sql
begin;

insert into auth.users(id, email) values
  ('0a000000-0000-4000-8000-000000000001', 'org-owner@integration.invalid'),
  ('0b000000-0000-4000-8000-000000000002', 'org-member@integration.invalid'),
  ('0c000000-0000-4000-8000-000000000003', 'org-applicant@integration.invalid');

select set_config('request.jwt.claim.sub', '0a000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  open_id uuid;
  private_id uuid;
begin
  open_id := public.create_organization(
    'Open integration league', 'open-integration-league', 'league', 'public',
    'Public fixture', null, 'Barcelona', array['modern']
  );
  private_id := public.create_organization(
    'Private integration team', 'private-integration-team', 'team', 'private',
    'Private fixture', null, null, array['commander']
  );
  if not public.has_organization_role(open_id, array['owner']::public.organization_member_role[])
    or not public.has_organization_role(private_id, array['owner']::public.organization_member_role[])
  then raise exception 'Organization creator was not made owner'; end if;
  if has_table_privilege('authenticated', 'public.organization_members', 'INSERT') then
    raise exception 'Authenticated users can forge memberships';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '0b000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare
  open_id uuid;
  private_id uuid;
  blocked boolean := false;
begin
  select id into open_id from public.organizations where slug = 'open-integration-league';
  select id into private_id from public.organizations where slug = 'private-integration-team';
  perform public.join_public_organization(open_id);
  if not public.is_organization_member(open_id) then raise exception 'Open organization join failed'; end if;

  begin
    perform public.join_public_organization(private_id);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Private organization allowed direct join'; end if;

  insert into public.organization_forum_topics(organization_id, author_id, title, body)
  values(open_id, auth.uid(), 'Member topic', 'Visible public topic');
  blocked := false;
  begin
    insert into public.organization_forum_topics(organization_id, author_id, title, body, is_pinned)
    values(open_id, auth.uid(), 'Forged pinned topic', 'Members cannot pin', true);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Regular member forged a pinned topic'; end if;
  blocked := false;
  begin
    insert into public.organization_announcements(organization_id, author_id, title, body)
    values(open_id, auth.uid(), 'Forged announcement', 'Members cannot announce');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Regular member created an announcement'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
declare private_id uuid;
begin
  select id into private_id from public.organizations where slug = 'private-integration-team';
  perform public.request_organization_access(private_id, 'Let me join');
  if public.is_organization_member(private_id) then raise exception 'Request created a membership before approval'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '0a000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  open_id uuid;
  private_id uuid;
  request_id uuid;
  blocked boolean := false;
begin
  select id into open_id from public.organizations where slug = 'open-integration-league';
  select id into private_id from public.organizations where slug = 'private-integration-team';
  select id into request_id from public.organization_join_requests
  where organization_id = private_id and status = 'pending';
  perform public.review_organization_request(request_id, true);
  if not exists (
    select 1 from public.organization_members
    where organization_id = private_id and user_id = '0c000000-0000-4000-8000-000000000003'
  ) then raise exception 'Approved request did not create membership'; end if;

  insert into public.organization_announcements(organization_id, author_id, title, body)
  values(open_id, auth.uid(), 'Official announcement', 'Administrators can announce');
  perform public.change_organization_member_role(
    open_id, '0b000000-0000-4000-8000-000000000002', 'admin'
  );

  begin
    perform public.leave_organization(private_id);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Last owner left a private organization'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '0c000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
declare private_id uuid;
begin
  select id into private_id from public.organizations where slug = 'private-integration-team';
  if not public.is_organization_member(private_id) then raise exception 'Approved applicant cannot see membership'; end if;
  insert into public.organization_forum_topics(organization_id, author_id, title, body)
  values(private_id, auth.uid(), 'Private topic', 'Members only');
end;
$$;
reset role;

set local role anon;
do $$
begin
  if not exists (select 1 from public.organization_forum_topics where title = 'Member topic') then
    raise exception 'Public forum is not readable anonymously';
  end if;
  if exists (select 1 from public.organization_forum_topics where title = 'Private topic') then
    raise exception 'Private forum leaked anonymously';
  end if;
  if not exists (select 1 from public.organization_announcements where title = 'Official announcement') then
    raise exception 'Public announcement is not readable anonymously';
  end if;
end;
$$;
reset role;

do $$ begin raise notice 'Organization assertions passed'; end $$;
rollback;
