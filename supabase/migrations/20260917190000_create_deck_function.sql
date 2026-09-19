create or replace function public.create_deck(
  p_title text,
  p_format text,
  p_visibility public.deck_visibility,
  p_cards jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_deck_id uuid;
  new_version_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if jsonb_array_length(p_cards) = 0 or jsonb_array_length(p_cards) > 500 then
    raise exception 'invalid card count';
  end if;

  insert into public.decks (owner_id, title, format, visibility)
  values (auth.uid(), p_title, p_format, p_visibility)
  returning id into new_deck_id;

  insert into public.deck_versions (deck_id, version)
  values (new_deck_id, 1)
  returning id into new_version_id;

  insert into public.deck_cards (
    deck_version_id,
    zone,
    quantity,
    oracle_id,
    scryfall_id,
    card_name,
    image_small_url,
    image_normal_url
  )
  select
    new_version_id,
    card.zone::public.deck_zone,
    card.quantity,
    card.oracle_id,
    card.scryfall_id,
    card.card_name,
    card.image_small_url,
    card.image_normal_url
  from jsonb_to_recordset(p_cards) as card(
    zone text,
    quantity smallint,
    oracle_id uuid,
    scryfall_id uuid,
    card_name text,
    image_small_url text,
    image_normal_url text
  );

  return new_deck_id;
end;
$$;

grant execute on function public.create_deck(text, text, public.deck_visibility, jsonb) to authenticated;
