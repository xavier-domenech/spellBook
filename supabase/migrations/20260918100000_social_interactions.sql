create or replace function public.create_social_post(
  p_content text,
  p_visibility public.post_visibility default 'public',
  p_deck_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_post_id uuid;
  selected_version_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if char_length(trim(p_content)) < 1 or char_length(trim(p_content)) > 500 then
    raise exception 'invalid post content';
  end if;

  if p_deck_id is not null then
    select deck_versions.id
      into selected_version_id
      from public.decks
      join public.deck_versions
        on deck_versions.deck_id = decks.id
       and deck_versions.version = decks.current_version
     where decks.id = p_deck_id
       and decks.owner_id = auth.uid();

    if selected_version_id is null then
      raise exception 'deck not found or not owned by user';
    end if;
  end if;

  insert into public.posts (author_id, content, visibility)
  values (auth.uid(), trim(p_content), p_visibility)
  returning id into new_post_id;

  if selected_version_id is not null then
    insert into public.post_decks (post_id, deck_version_id)
    values (new_post_id, selected_version_id);
  end if;

  return new_post_id;
end;
$$;

create or replace function public.toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  delete from public.post_likes
   where post_id = p_post_id and user_id = auth.uid();

  if found then
    return false;
  end if;

  insert into public.post_likes (post_id, user_id)
  values (p_post_id, auth.uid());
  return true;
end;
$$;

create or replace function public.toggle_repost(p_post_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  delete from public.reposts
   where post_id = p_post_id and user_id = auth.uid();

  if found then
    return false;
  end if;

  insert into public.reposts (post_id, user_id)
  values (p_post_id, auth.uid());
  return true;
end;
$$;

create or replace function public.toggle_follow(p_profile_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if auth.uid() = p_profile_id then
    raise exception 'users cannot follow themselves';
  end if;

  delete from public.follows
   where follower_id = auth.uid() and followed_id = p_profile_id;

  if found then
    return false;
  end if;

  insert into public.follows (follower_id, followed_id)
  values (auth.uid(), p_profile_id);
  return true;
end;
$$;

create or replace function public.get_post_deck_attachments(p_post_ids uuid[])
returns table (
  post_id uuid,
  deck_id uuid,
  deck_version_id uuid,
  version integer,
  title text,
  format text,
  total_cards bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    post_decks.post_id,
    decks.id,
    deck_versions.id,
    deck_versions.version,
    decks.title,
    decks.format,
    coalesce(sum(deck_cards.quantity), 0)::bigint
  from public.post_decks
  join public.deck_versions on deck_versions.id = post_decks.deck_version_id
  join public.decks on decks.id = deck_versions.deck_id
  left join public.deck_cards on deck_cards.deck_version_id = deck_versions.id
  where post_decks.post_id = any(p_post_ids)
  group by post_decks.post_id, decks.id, deck_versions.id;
$$;

grant execute on function public.create_social_post(text, public.post_visibility, uuid) to authenticated;
grant execute on function public.toggle_post_like(uuid) to authenticated;
grant execute on function public.toggle_repost(uuid) to authenticated;
grant execute on function public.toggle_follow(uuid) to authenticated;
grant execute on function public.get_post_deck_attachments(uuid[]) to anon, authenticated;
