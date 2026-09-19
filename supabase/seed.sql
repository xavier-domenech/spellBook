-- Datos de demostracion para Magic Social.
-- Es idempotente y conserva el contenido creado manualmente por xavidp.

begin;

-- En un reset limpio crea una cuenta local con la que entrar:
-- xavidp@demo.magicsocial.local / MagicSocial123!
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'xavidp@demo.magicsocial.local',
  extensions.crypt('MagicSocial123!', extensions.gen_salt('bf')),
  now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"xavidp"}',
  now(), now()
where not exists (
  select 1
  from auth.users existing_user
  left join public.profiles existing_profile on existing_profile.id = existing_user.id
  where existing_user.email = 'xavidp@demo.magicsocial.local'
     or existing_profile.handle = 'xavidp'
)
on conflict do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  '00000000-0000-4000-9000-000000000001',
  user_account.id::text,
  user_account.id,
  jsonb_build_object(
    'sub', user_account.id::text,
    'email', user_account.email,
    'display_name', 'xavidp',
    'email_verified', true,
    'phone_verified', false
  ),
  'email', now(), now(), now()
from auth.users user_account
where user_account.id = '00000000-0000-4000-8000-000000000001'
on conflict do nothing;

create temporary table seed_target_user (id uuid primary key) on commit drop;

insert into seed_target_user (id)
select profiles.id
from public.profiles
join auth.users on auth.users.id = profiles.id
where auth.users.email = 'xavidp@demo.magicsocial.local' or profiles.handle = 'xavidp'
order by (auth.users.email = 'xavidp@demo.magicsocial.local') desc
limit 1;

do $$
begin
  if not exists (select 1 from seed_target_user) then
    raise exception 'No se encontro el usuario local xavidp';
  end if;
end
$$;

-- Mantiene los datos que el usuario ya haya personalizado.
update public.profiles
set handle = case when handle::text like 'mage_%' then 'xavidp' else handle end,
    bio = case when bio = '' then 'Jugador de Magic probando mazos y compartiendo ideas.' else bio end,
    favorite_formats = case when cardinality(favorite_formats) = 0 then array['commander', 'modern'] else favorite_formats end
where id = (select id from seed_target_user)
  and not exists (
    select 1 from public.profiles other
    where other.handle = 'xavidp' and other.id <> profiles.id
  );

-- La misma cuenta que usa la plataforma administra el contenido editorial.
insert into public.user_roles (user_id, role, granted_by)
select id, 'admin'::public.app_role, id
from seed_target_user
on conflict do nothing;

-- Perfiles ficticios. No se usan credenciales reales ni se pretende iniciar sesion con ellos.
insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'ariadna@demo.magicsocial.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Ariadna Serra"}', now() - interval '90 days', now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'marc@demo.magicsocial.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Marc Vidal"}', now() - interval '75 days', now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'noelia@demo.magicsocial.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Noelia Costa"}', now() - interval '62 days', now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'pau@demo.magicsocial.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Pau Ferrer"}', now() - interval '48 days', now()),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'clara@demo.magicsocial.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Clara Soler"}', now() - interval '40 days', now()),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'nil@demo.magicsocial.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Nil Roig"}', now() - interval '28 days', now())
on conflict (id) do update
set raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into public.profiles (id, handle, display_name, bio, favorite_formats, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'ariadna_control', 'Ariadna Serra', 'Control, cafe y muchas respuestas en la mano.', array['commander', 'modern'], now() - interval '90 days'),
  ('22222222-2222-4222-8222-222222222222', 'marc_modern', 'Marc Vidal', 'Jugador de Modern. Siempre probando la carta 61.', array['modern'], now() - interval '75 days'),
  ('33333333-3333-4333-8333-333333333333', 'noelia_edh', 'Noelia Costa', 'Commander social, mazos tematicos y mesas sin prisas.', array['commander'], now() - interval '62 days'),
  ('44444444-4444-4444-8444-444444444444', 'pau_pioneer', 'Pau Ferrer', 'Pioneer entre semana, drafts siempre que puedo.', array['pioneer'], now() - interval '48 days'),
  ('55555555-5555-4555-8555-555555555555', 'clara_judge', 'Clara Soler', 'Jueza de tienda. Pregunta de reglas bienvenida.', array['standard', 'commander'], now() - interval '40 days'),
  ('66666666-6666-4666-8666-666666666666', 'nil_combo', 'Nil Roig', 'Construyo combos optimistas y bases de mana responsables.', array['commander', 'modern'], now() - interval '28 days')
on conflict (id) do update
set handle = excluded.handle,
    display_name = excluded.display_name,
    bio = excluded.bio,
    favorite_formats = excluded.favorite_formats;

-- xavidp sigue a cuatro personas y recibe cuatro seguidores; hay dos relaciones mutuas.
insert into public.follows (follower_id, followed_id, created_at)
select target.id, person.id, now() - person.age
from seed_target_user target
cross join (values
  ('11111111-1111-4111-8111-111111111111'::uuid, interval '20 days'),
  ('22222222-2222-4222-8222-222222222222'::uuid, interval '12 days'),
  ('33333333-3333-4333-8333-333333333333'::uuid, interval '8 days'),
  ('44444444-4444-4444-8444-444444444444'::uuid, interval '3 days')
) as person(id, age)
on conflict do nothing;

insert into public.follows (follower_id, followed_id, created_at)
select person.id, target.id, now() - person.age
from seed_target_user target
cross join (values
  ('11111111-1111-4111-8111-111111111111'::uuid, interval '18 days'),
  ('33333333-3333-4333-8333-333333333333'::uuid, interval '7 days'),
  ('55555555-5555-4555-8555-555555555555'::uuid, interval '2 days'),
  ('66666666-6666-4666-8666-666666666666'::uuid, interval '10 hours')
) as person(id, age)
on conflict do nothing;

insert into public.follows (follower_id, followed_id, created_at)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', now() - interval '30 days'),
  ('33333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555', now() - interval '16 days'),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', now() - interval '11 days'),
  ('66666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333', now() - interval '6 days')
on conflict do nothing;

-- Mazos publicos: dos pertenecen a xavidp y seis a perfiles demo.
insert into public.decks (id, owner_id, title, format, description, visibility, current_version, created_at, updated_at)
select 'a0000000-0000-4000-8000-000000000001', id, 'Atraxa: laboratorio de contadores', 'commander', 'Borrador para probar proliferar y ajustar la interaccion de la mesa.', 'public', 1, now() - interval '5 days', now() - interval '4 hours'
from seed_target_user
on conflict (id) do update set owner_id = excluded.owner_id, title = excluded.title, description = excluded.description, updated_at = excluded.updated_at;

insert into public.decks (id, owner_id, title, format, description, visibility, current_version, created_at, updated_at)
select 'a0000000-0000-4000-8000-000000000002', id, 'Rakdos Midrange - notas', 'pioneer', 'Nucleo inicial para iterar una lista de Pioneer.', 'public', 1, now() - interval '2 days', now() - interval '2 hours'
from seed_target_user
on conflict (id) do update set owner_id = excluded.owner_id, title = excluded.title, description = excluded.description, updated_at = excluded.updated_at;

insert into public.decks (id, owner_id, title, format, description, visibility, current_version, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000101', '11111111-1111-4111-8111-111111111111', 'Respuestas de Azorius', 'commander', 'Paquete de interaccion para una mesa de Commander.', 'public', 1, now() - interval '21 days', now() - interval '40 minutes'),
  ('a0000000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222222', 'Delirium tempo', 'modern', 'Lista completa de Izzet tempo con amenazas baratas y delirium.', 'public', 1, now() - interval '14 days', now() - interval '3 hours'),
  ('a0000000-0000-4000-8000-000000000103', '33333333-3333-4333-8333-333333333333', 'Caja de herramientas EDH', 'commander', 'Staples para empezar a construir sin perder la identidad del mazo.', 'public', 1, now() - interval '10 days', now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000104', '44444444-4444-4444-8444-444444444444', 'Mono Black Pioneer', 'pioneer', 'Base de midrange con descarte y removal eficiente.', 'public', 1, now() - interval '8 days', now() - interval '6 hours'),
  ('a0000000-0000-4000-8000-000000000105', '66666666-6666-4666-8666-666666666666', 'Ramp y proteccion', 'commander', 'Esqueleto verde para acelerar y proteger la pieza principal.', 'public', 1, now() - interval '6 days', now() - interval '12 hours'),
  ('a0000000-0000-4000-8000-000000000106', '66666666-6666-4666-8666-666666666666', 'Delirium tempo - variante', 'modern', 'Variante completa con seis cartas distintas para probar la agrupacion automatica.', 'public', 1, now() - interval '4 days', now() - interval '8 hours')
on conflict (id) do update
set owner_id = excluded.owner_id,
    title = excluded.title,
    format = excluded.format,
    description = excluded.description,
    updated_at = excluded.updated_at;

insert into public.deck_versions (id, deck_id, version, note, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 'Primer borrador para probar el visor.', now() - interval '5 days'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 1, 'Nucleo de descarte y removal.', now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000101', 1, 'Seleccion inicial de respuestas.', now() - interval '21 days'),
  ('b0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000102', 1, 'Prueba del viernes.', now() - interval '14 days'),
  ('b0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000103', 1, 'Base reutilizable para futuros mazos.', now() - interval '10 days'),
  ('b0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000104', 1, 'Lista inicial.', now() - interval '8 days'),
  ('b0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000105', 1, 'Paquete de aceleracion y proteccion.', now() - interval '6 days'),
  ('b0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000106', 1, 'Variante de prueba con un 90 por ciento de coincidencia.', now() - interval '4 days')
on conflict (id) do update set note = excluded.note;

create temporary table seed_cards (
  card_name text primary key,
  scryfall_id uuid not null,
  oracle_id uuid,
  image_small_url text,
  image_normal_url text
) on commit drop;

insert into seed_cards values
  ('Atraxa, Praetors'' Voice', 'd0d33d52-3d28-4635-b985-51e126289259', '7e6b9b59-cd68-4e3c-827b-38833c92d6eb', 'https://cards.scryfall.io/small/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1783930136', 'https://cards.scryfall.io/normal/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1783930136'),
  ('Sol Ring', '8ee443cc-e17a-493b-9c93-1f9e141a30e4', '6ad8011d-3471-4369-9d68-b264cc027487', 'https://cards.scryfall.io/small/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446', 'https://cards.scryfall.io/normal/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446'),
  ('Arcane Signet', 'c6b6117c-faab-4bbb-b851-07bd8061ef03', '0bc7f093-bef0-4f1a-852c-4b75ebf54838', 'https://cards.scryfall.io/small/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435', 'https://cards.scryfall.io/normal/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435'),
  ('Command Tower', '1ac6cb62-45da-4e9a-84c6-09e6eacf0664', '0895c9b7-ae7d-4bb3-af17-3b75deb50a25', 'https://cards.scryfall.io/small/front/1/a/1ac6cb62-45da-4e9a-84c6-09e6eacf0664.jpg?1789644465', 'https://cards.scryfall.io/normal/front/1/a/1ac6cb62-45da-4e9a-84c6-09e6eacf0664.jpg?1789644465'),
  ('Swords to Plowshares', 'f7e12477-d59f-442b-a678-1be746d0b7be', 'b1544f21-7e98-461b-aed5-e748b0168c52', 'https://cards.scryfall.io/small/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810', 'https://cards.scryfall.io/normal/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810'),
  ('Cultivate', 'e60deb92-f7dd-4f4e-9036-e47dd586f985', '8b755881-a72d-4e21-a369-d2924eb4585a', 'https://cards.scryfall.io/small/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229', 'https://cards.scryfall.io/normal/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229'),
  ('Counterspell', '4f616706-ec97-4923-bb1e-11a69fbaa1f8', 'cc187110-1148-4090-bbb8-e205694a39f5', 'https://cards.scryfall.io/small/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.jpg?1783909630', 'https://cards.scryfall.io/normal/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.jpg?1783909630'),
  ('Path to Exile', '22e08a78-55b7-46b0-bd1a-a51548fc1861', 'd683d985-9888-4d21-8b5f-69e69ce4a03b', 'https://cards.scryfall.io/small/front/2/2/22e08a78-55b7-46b0-bd1a-a51548fc1861.jpg?1789599789', 'https://cards.scryfall.io/normal/front/2/2/22e08a78-55b7-46b0-bd1a-a51548fc1861.jpg?1789599789'),
  ('Smothering Tithe', '861b5889-0183-4bee-afeb-a4b2aa700a8e', '153376c9-dffd-458c-8ce3-a4c8269bc4e9', 'https://cards.scryfall.io/small/front/8/6/861b5889-0183-4bee-afeb-a4b2aa700a8e.jpg?1783915712', 'https://cards.scryfall.io/normal/front/8/6/861b5889-0183-4bee-afeb-a4b2aa700a8e.jpg?1783915712'),
  ('Cyclonic Rift', 'dfb7c4b9-f2f4-4d4e-baf2-86551c8150fe', 'd75b9c82-1b49-4c3e-a1b5-aeef57d6644b', 'https://cards.scryfall.io/small/front/d/f/dfb7c4b9-f2f4-4d4e-baf2-86551c8150fe.jpg?1783913339', 'https://cards.scryfall.io/normal/front/d/f/dfb7c4b9-f2f4-4d4e-baf2-86551c8150fe.jpg?1783913339'),
  ('Birds of Paradise', '492c2f9a-51e7-4e0f-9899-23bf43ea988b', 'd3a0b660-358c-41bd-9cd2-41fbf3491b1a', 'https://cards.scryfall.io/small/front/4/9/492c2f9a-51e7-4e0f-9899-23bf43ea988b.jpg?1783903230', 'https://cards.scryfall.io/normal/front/4/9/492c2f9a-51e7-4e0f-9899-23bf43ea988b.jpg?1783903230'),
  ('Demonic Tutor', 'a24b4cb6-cebb-428b-8654-74347a6a8d63', '82004860-e589-4e38-8d61-8c0210e4ea39', 'https://cards.scryfall.io/small/front/a/2/a24b4cb6-cebb-428b-8654-74347a6a8d63.jpg?1783915679', 'https://cards.scryfall.io/normal/front/a/2/a24b4cb6-cebb-428b-8654-74347a6a8d63.jpg?1783915679'),
  ('Lightning Bolt', '7673784e-db4b-43a1-8d55-1bb9fc1e284f', '4457ed35-7c10-48c8-9776-456485fdf070', 'https://cards.scryfall.io/small/front/7/6/7673784e-db4b-43a1-8d55-1bb9fc1e284f.jpg?1783903008', 'https://cards.scryfall.io/normal/front/7/6/7673784e-db4b-43a1-8d55-1bb9fc1e284f.jpg?1783903008'),
  ('Ragavan, Nimble Pilferer', 'a9738cda-adb1-47fb-9f4c-ecd930228c4d', '37108cd4-bbab-4ce3-9ed6-f60e8422e703', 'https://cards.scryfall.io/small/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg?1783926839', 'https://cards.scryfall.io/normal/front/a/9/a9738cda-adb1-47fb-9f4c-ecd930228c4d.jpg?1783926839'),
  ('Dragon''s Rage Channeler', '4ced112a-e775-4f97-97b3-74877e9dce12', '0c016ccc-a341-4b76-87ba-69c639d2746d', 'https://cards.scryfall.io/small/front/4/c/4ced112a-e775-4f97-97b3-74877e9dce12.jpg?1783926848', 'https://cards.scryfall.io/normal/front/4/c/4ced112a-e775-4f97-97b3-74877e9dce12.jpg?1783926848'),
  ('Mishra''s Bauble', '45bbbf9b-8fee-4c32-a513-02dac6ac8a39', '63afc3d1-7653-476e-838f-fc18d4a62a21', 'https://cards.scryfall.io/small/front/4/5/45bbbf9b-8fee-4c32-a513-02dac6ac8a39.jpg?1783930102', 'https://cards.scryfall.io/normal/front/4/5/45bbbf9b-8fee-4c32-a513-02dac6ac8a39.jpg?1783930102'),
  ('Unholy Heat', '4e879386-b1f8-4f2a-9820-6e1291746f88', 'b23cba46-6ed2-442d-bc39-7c4933f6b083', 'https://cards.scryfall.io/small/front/4/e/4e879386-b1f8-4f2a-9820-6e1291746f88.jpg?1783911915', 'https://cards.scryfall.io/normal/front/4/e/4e879386-b1f8-4f2a-9820-6e1291746f88.jpg?1783911915'),
  ('Blood Moon', 'd072e9ca-aae7-45dc-8025-3ce590bae63f', '94fac5fe-97d5-4c12-a80c-8efff9d853ae', 'https://cards.scryfall.io/small/front/d/0/d072e9ca-aae7-45dc-8025-3ce590bae63f.jpg?1783930171', 'https://cards.scryfall.io/normal/front/d/0/d072e9ca-aae7-45dc-8025-3ce590bae63f.jpg?1783930171'),
  ('Thoughtseize', 'b281a308-ab6b-47b6-bec7-632c9aaecede', 'edd8d1e8-be43-4c38-bb3a-83081fbaf0b5', 'https://cards.scryfall.io/small/front/b/2/b281a308-ab6b-47b6-bec7-632c9aaecede.jpg?1783930173', 'https://cards.scryfall.io/normal/front/b/2/b281a308-ab6b-47b6-bec7-632c9aaecede.jpg?1783930173'),
  ('Fatal Push', '6e9d8fe4-fd9b-4923-92bf-7dd6b8fa02e7', '16437a83-be52-44cd-a768-a767c9347eb2', 'https://cards.scryfall.io/small/front/6/e/6e9d8fe4-fd9b-4923-92bf-7dd6b8fa02e7.jpg?1783930180', 'https://cards.scryfall.io/normal/front/6/e/6e9d8fe4-fd9b-4923-92bf-7dd6b8fa02e7.jpg?1783930180'),
  ('Sheoldred, the Apocalypse', 'd67be074-cdd4-41d9-ac89-0a0456c4e4b2', '34f34409-326d-4994-a0ea-1a69aa278f03', 'https://cards.scryfall.io/small/front/d/6/d67be074-cdd4-41d9-ac89-0a0456c4e4b2.jpg?1783921327', 'https://cards.scryfall.io/normal/front/d/6/d67be074-cdd4-41d9-ac89-0a0456c4e4b2.jpg?1783921327'),
  ('Rhystic Study', '9f37c5b6-a59c-45cd-9a99-e9357fe9ea1b', '53236dd7-845a-444c-96d5-f41ed7325d8f', 'https://cards.scryfall.io/small/front/9/f/9f37c5b6-a59c-45cd-9a99-e9357fe9ea1b.jpg?1783919146', 'https://cards.scryfall.io/normal/front/9/f/9f37c5b6-a59c-45cd-9a99-e9357fe9ea1b.jpg?1783919146'),
  ('Swiftfoot Boots', '03f7e9fc-8e59-45c1-90fc-1d04d929b292', 'c8b143ad-43ec-4e0d-a440-e348daa31391', 'https://cards.scryfall.io/small/front/0/3/03f7e9fc-8e59-45c1-90fc-1d04d929b292.jpg?1785759388', 'https://cards.scryfall.io/normal/front/0/3/03f7e9fc-8e59-45c1-90fc-1d04d929b292.jpg?1785759388'),
  ('Lightning Greaves', 'b61634ae-05be-4b56-8ebb-9d4ade902e42', 'ca204b66-8d0c-431a-8d34-282f7c2d17da', 'https://cards.scryfall.io/small/front/b/6/b61634ae-05be-4b56-8ebb-9d4ade902e42.jpg?1783903217', 'https://cards.scryfall.io/normal/front/b/6/b61634ae-05be-4b56-8ebb-9d4ade902e42.jpg?1783903217'),
  ('Beast Within', '400b43aa-c1d2-4435-b863-061f43889422', '7735eeba-693b-47e2-bd51-414379cf1016', 'https://cards.scryfall.io/small/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232', 'https://cards.scryfall.io/normal/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232'),
  ('Heroic Intervention', 'e32c67d1-187f-40df-b3b3-6036f5c92834', '24882fa2-3fe9-4c1b-aa3d-0e6488b9db27', 'https://cards.scryfall.io/small/front/e/3/e32c67d1-187f-40df-b3b3-6036f5c92834.jpg?1783915629', 'https://cards.scryfall.io/normal/front/e/3/e32c67d1-187f-40df-b3b3-6036f5c92834.jpg?1783915629'),
  ('Murktide Regent', '20c4aae1-7665-4df7-bd51-a1d95bf8a17d', '7f993ac7-c2cd-413c-a106-2c051a77ebf6', 'https://cards.scryfall.io/small/front/2/0/20c4aae1-7665-4df7-bd51-a1d95bf8a17d.jpg?1783926875', 'https://cards.scryfall.io/normal/front/2/0/20c4aae1-7665-4df7-bd51-a1d95bf8a17d.jpg?1783926875'),
  ('Consider', '4f28e706-c488-4525-ad8a-977a5fa77f80', '4c9bcba6-87b5-4fb3-97ee-6fe5b739337d', 'https://cards.scryfall.io/small/front/4/f/4f28e706-c488-4525-ad8a-977a5fa77f80.jpg?1783904806', 'https://cards.scryfall.io/normal/front/4/f/4f28e706-c488-4525-ad8a-977a5fa77f80.jpg?1783904806'),
  ('Spell Pierce', '8dd4374f-0301-4b2e-bc99-2cd19568cb3b', 'd64b0848-0193-4025-ba62-63ecd8fb9f50', 'https://cards.scryfall.io/small/front/8/d/8dd4374f-0301-4b2e-bc99-2cd19568cb3b.jpg?1783907902', 'https://cards.scryfall.io/normal/front/8/d/8dd4374f-0301-4b2e-bc99-2cd19568cb3b.jpg?1783907902'),
  ('Force of Negation', '1825a719-1b2a-4af9-9cd2-7cb497cd0317', 'ac2173f9-f223-440a-9231-fd98762bdc6f', 'https://cards.scryfall.io/small/front/1/8/1825a719-1b2a-4af9-9cd2-7cb497cd0317.jpg?1783921916', 'https://cards.scryfall.io/normal/front/1/8/1825a719-1b2a-4af9-9cd2-7cb497cd0317.jpg?1783921916'),
  ('Scalding Tarn', '71e491c5-8c07-449b-b2f1-ffa052e6d311', 'cb027150-848c-4a66-88ad-e20222304dd8', 'https://cards.scryfall.io/small/front/7/1/71e491c5-8c07-449b-b2f1-ffa052e6d311.jpg?1783926793', 'https://cards.scryfall.io/normal/front/7/1/71e491c5-8c07-449b-b2f1-ffa052e6d311.jpg?1783926793'),
  ('Misty Rainforest', '88231c0d-0cc8-44ec-bf95-81d1710ac141', '09dd85aa-47bc-4713-a9b9-8b52ff2285ed', 'https://cards.scryfall.io/small/front/8/8/88231c0d-0cc8-44ec-bf95-81d1710ac141.jpg?1783926795', 'https://cards.scryfall.io/normal/front/8/8/88231c0d-0cc8-44ec-bf95-81d1710ac141.jpg?1783926795'),
  ('Steam Vents', 'a83903c7-fd51-4526-aed2-359e946fea36', '17039058-822d-409f-938c-b727a366ba63', 'https://cards.scryfall.io/small/front/a/8/a83903c7-fd51-4526-aed2-359e946fea36.jpg?1784036844', 'https://cards.scryfall.io/normal/front/a/8/a83903c7-fd51-4526-aed2-359e946fea36.jpg?1784036844'),
  ('Spirebluff Canal', '59a04e16-a767-4112-ab01-6ca1b09c286c', 'eb0d8093-5f93-4b25-9384-08f9731bfb28', 'https://cards.scryfall.io/small/front/5/9/59a04e16-a767-4112-ab01-6ca1b09c286c.jpg?1783911772', 'https://cards.scryfall.io/normal/front/5/9/59a04e16-a767-4112-ab01-6ca1b09c286c.jpg?1783911772'),
  ('Island', 'f3cc07cd-cc79-4745-b0b7-eade60175cc3', 'b2c6aa39-2d2a-459c-a555-fb48ba993373', 'https://cards.scryfall.io/small/front/f/3/f3cc07cd-cc79-4745-b0b7-eade60175cc3.jpg?1785981645', 'https://cards.scryfall.io/normal/front/f/3/f3cc07cd-cc79-4745-b0b7-eade60175cc3.jpg?1785981645'),
  ('Mountain', '2a844b96-6616-4c39-8f4f-5d14a3b2bd55', 'a3fb7228-e76b-4e96-a40e-20b5fed75685', 'https://cards.scryfall.io/small/front/2/a/2a844b96-6616-4c39-8f4f-5d14a3b2bd55.jpg?1785981666', 'https://cards.scryfall.io/normal/front/2/a/2a844b96-6616-4c39-8f4f-5d14a3b2bd55.jpg?1785981666'),
  ('Preordain', 'dd29a0e5-c1de-4e8a-8866-715e9f9cde1f', 'ac641490-ca14-48d7-8cc4-b69ce984befa', 'https://cards.scryfall.io/small/front/d/d/dd29a0e5-c1de-4e8a-8866-715e9f9cde1f.jpg?1783907099', 'https://cards.scryfall.io/normal/front/d/d/dd29a0e5-c1de-4e8a-8866-715e9f9cde1f.jpg?1783907099'),
  ('Subtlety', '701256d5-1389-48b7-9581-d6037209bd06', '377179d5-ac83-4d34-b5b1-f3d8caa60f79', 'https://cards.scryfall.io/small/front/7/0/701256d5-1389-48b7-9581-d6037209bd06.jpg?1783926869', 'https://cards.scryfall.io/normal/front/7/0/701256d5-1389-48b7-9581-d6037209bd06.jpg?1783926869'),
  ('Flooded Strand', '8f85e12c-196b-4459-b81f-0c9c854e9f57', 'f3c7af78-a77d-4134-82a2-a5ce84285a84', 'https://cards.scryfall.io/small/front/8/f/8f85e12c-196b-4459-b81f-0c9c854e9f57.jpg?1783911240', 'https://cards.scryfall.io/normal/front/8/f/8f85e12c-196b-4459-b81f-0c9c854e9f57.jpg?1783911240');

delete from public.deck_cards
where deck_version_id in (
  'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000102',
  'b0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000104',
  'b0000000-0000-4000-8000-000000000105', 'b0000000-0000-4000-8000-000000000106'
);

insert into public.deck_cards (deck_version_id, zone, quantity, oracle_id, scryfall_id, card_name, image_small_url, image_normal_url)
select spec.deck_version_id, spec.zone::public.deck_zone, spec.quantity, card.oracle_id, card.scryfall_id, card.card_name, card.image_small_url, card.image_normal_url
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'commander', 1::smallint, 'Atraxa, Praetors'' Voice'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Sol Ring'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Arcane Signet'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Command Tower'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Swords to Plowshares'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Cultivate'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Counterspell'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Path to Exile'),
  ('b0000000-0000-4000-8000-000000000001', 'mainboard', 1, 'Demonic Tutor'),
  ('b0000000-0000-4000-8000-000000000002', 'mainboard', 4, 'Thoughtseize'),
  ('b0000000-0000-4000-8000-000000000002', 'mainboard', 4, 'Fatal Push'),
  ('b0000000-0000-4000-8000-000000000002', 'mainboard', 3, 'Sheoldred, the Apocalypse'),
  ('b0000000-0000-4000-8000-000000000101', 'mainboard', 1, 'Counterspell'),
  ('b0000000-0000-4000-8000-000000000101', 'mainboard', 1, 'Path to Exile'),
  ('b0000000-0000-4000-8000-000000000101', 'mainboard', 1, 'Swords to Plowshares'),
  ('b0000000-0000-4000-8000-000000000101', 'mainboard', 1, 'Cyclonic Rift'),
  ('b0000000-0000-4000-8000-000000000101', 'mainboard', 1, 'Smothering Tithe'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Lightning Bolt'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Ragavan, Nimble Pilferer'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Dragon''s Rage Channeler'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Mishra''s Bauble'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Unholy Heat'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Murktide Regent'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Counterspell'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Consider'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 2, 'Spell Pierce'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 2, 'Force of Negation'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Scalding Tarn'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Misty Rainforest'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Steam Vents'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Spirebluff Canal'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Island'),
  ('b0000000-0000-4000-8000-000000000102', 'mainboard', 4, 'Mountain'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Lightning Bolt'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Ragavan, Nimble Pilferer'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Dragon''s Rage Channeler'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Mishra''s Bauble'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Unholy Heat'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Murktide Regent'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Counterspell'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Consider'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 2, 'Preordain'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 2, 'Subtlety'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Scalding Tarn'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 2, 'Misty Rainforest'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 2, 'Flooded Strand'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Steam Vents'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Spirebluff Canal'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Island'),
  ('b0000000-0000-4000-8000-000000000106', 'mainboard', 4, 'Mountain'),
  ('b0000000-0000-4000-8000-000000000103', 'mainboard', 1, 'Sol Ring'),
  ('b0000000-0000-4000-8000-000000000103', 'mainboard', 1, 'Arcane Signet'),
  ('b0000000-0000-4000-8000-000000000103', 'mainboard', 1, 'Command Tower'),
  ('b0000000-0000-4000-8000-000000000103', 'mainboard', 1, 'Rhystic Study'),
  ('b0000000-0000-4000-8000-000000000103', 'mainboard', 1, 'Swiftfoot Boots'),
  ('b0000000-0000-4000-8000-000000000103', 'mainboard', 1, 'Lightning Greaves'),
  ('b0000000-0000-4000-8000-000000000104', 'mainboard', 4, 'Thoughtseize'),
  ('b0000000-0000-4000-8000-000000000104', 'mainboard', 4, 'Fatal Push'),
  ('b0000000-0000-4000-8000-000000000104', 'mainboard', 3, 'Sheoldred, the Apocalypse'),
  ('b0000000-0000-4000-8000-000000000105', 'mainboard', 1, 'Birds of Paradise'),
  ('b0000000-0000-4000-8000-000000000105', 'mainboard', 1, 'Cultivate'),
  ('b0000000-0000-4000-8000-000000000105', 'mainboard', 1, 'Beast Within'),
  ('b0000000-0000-4000-8000-000000000105', 'mainboard', 1, 'Heroic Intervention'),
  ('b0000000-0000-4000-8000-000000000105', 'mainboard', 1, 'Sol Ring')
) as spec(deck_version_id, zone, quantity, card_name)
join seed_cards card using (card_name);

-- Actividad reciente para que el feed muestre conversaciones, mazos e interacciones.
insert into public.posts (id, author_id, content, visibility, created_at, updated_at)
values
  ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'He recortado dos counters para meter respuestas que tambien sean utiles al robarlas tarde. Esta es la version que probare hoy.', 'public', now() - interval '38 minutes', now() - interval '38 minutes'),
  ('c0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Delirium ha vuelto a sentirse muy fluido. La duda: segunda Blood Moon o una respuesta mas flexible en el banquillo.', 'public', now() - interval '2 hours', now() - interval '2 hours'),
  ('c0000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'Recordatorio amistoso: hablar del nivel de la mesa antes de empezar mejora mas la partida que cualquier staple.', 'public', now() - interval '4 hours', now() - interval '4 hours'),
  ('c0000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'Tres rondas con Mono Black: el nucleo funciona, pero necesito mejorar el plan contra cementerio.', 'public', now() - interval '7 hours', now() - interval '7 hours'),
  ('c0000000-0000-4000-8000-000000000005', '55555555-5555-4555-8555-555555555555', 'Pregunta de reglas del dia: si dos disparadas controladas por ti ocurren a la vez, tu eliges el orden en la pila.', 'public', now() - interval '11 hours', now() - interval '11 hours'),
  ('c0000000-0000-4000-8000-000000000006', '66666666-6666-4666-8666-666666666666', 'Mi regla al construir: primero aceleracion y proteccion; el combo espectacular viene despues.', 'public', now() - interval '15 hours', now() - interval '15 hours'),
  ('c0000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'Busco recomendaciones para ajustar una base de mana de cuatro colores sin convertir cada partida en barajar diez minutos.', 'public', now() - interval '1 day 2 hours', now() - interval '1 day 2 hours'),
  ('c0000000-0000-4000-8000-000000000008', '33333333-3333-4333-8333-333333333333', 'He preparado una pequena caja de herramientas para no empezar cada lista de Commander desde cero.', 'public', now() - interval '1 day 8 hours', now() - interval '1 day 8 hours'),
  ('c0000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'El mejor dato del test no fue el 3-1: fueron las cinco manos iniciales que tuve que devolver. Toca revisar tierras.', 'public', now() - interval '2 days', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000010', '55555555-5555-4555-8555-555555555555', 'Este viernes estare en tienda para una sesion abierta de dudas de reglas antes del FNM.', 'public', now() - interval '2 days 5 hours', now() - interval '2 days 5 hours'),
  ('c0000000-0000-4000-8000-000000000011', '44444444-4444-4444-8444-444444444444', 'Comparto el esqueleto de la lista. Aun no esta completa, pero ya permite discutir las decisiones importantes.', 'public', now() - interval '3 days', now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000012', '66666666-6666-4666-8666-666666666666', 'Heroic Intervention vuelve a quedarse. No es la carta mas original, pero protege justo el turno que importa.', 'public', now() - interval '4 days', now() - interval '4 days')
on conflict (id) do update
set content = excluded.content,
    updated_at = excluded.updated_at;

insert into public.post_decks (post_id, deck_version_id)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000102'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000104'),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000105'),
  ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000103'),
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000104')
on conflict (post_id) do update set deck_version_id = excluded.deck_version_id;

insert into public.post_likes (post_id, user_id, created_at)
select activity.post_id, target.id, now() - activity.age
from seed_target_user target
cross join (values
  ('c0000000-0000-4000-8000-000000000001'::uuid, interval '20 minutes'),
  ('c0000000-0000-4000-8000-000000000003'::uuid, interval '3 hours'),
  ('c0000000-0000-4000-8000-000000000005'::uuid, interval '10 hours'),
  ('c0000000-0000-4000-8000-000000000008'::uuid, interval '1 day')
) as activity(post_id, age)
on conflict do nothing;

insert into public.post_likes (post_id, user_id, created_at)
values
  ('c0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', now() - interval '30 minutes'),
  ('c0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', now() - interval '25 minutes'),
  ('c0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', now() - interval '90 minutes'),
  ('c0000000-0000-4000-8000-000000000003', '55555555-5555-4555-8555-555555555555', now() - interval '3 hours'),
  ('c0000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', now() - interval '6 hours'),
  ('c0000000-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333333', now() - interval '9 hours'),
  ('c0000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', now() - interval '12 hours'),
  ('c0000000-0000-4000-8000-000000000008', '66666666-6666-4666-8666-666666666666', now() - interval '1 day'),
  ('c0000000-0000-4000-8000-000000000010', '44444444-4444-4444-8444-444444444444', now() - interval '2 days')
on conflict do nothing;

insert into public.reposts (post_id, user_id, created_at)
select activity.post_id, target.id, now() - activity.age
from seed_target_user target
cross join (values
  ('c0000000-0000-4000-8000-000000000002'::uuid, interval '1 hour'),
  ('c0000000-0000-4000-8000-000000000010'::uuid, interval '2 days')
) as activity(post_id, age)
on conflict do nothing;

insert into public.reposts (post_id, user_id, created_at)
values
  ('c0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', now() - interval '2 hours'),
  ('c0000000-0000-4000-8000-000000000005', '66666666-6666-4666-8666-666666666666', now() - interval '8 hours'),
  ('c0000000-0000-4000-8000-000000000008', '44444444-4444-4444-8444-444444444444', now() - interval '1 day')
on conflict do nothing;

-- Organizaciones de demostracion: una liga publica y un equipo privado.
insert into public.organizations (
  id, slug, name, kind, access, description, website_url, location, formats, created_by, created_at
)
values
  (
    'd0000000-0000-4000-8000-000000000001', 'lliga-spellbook', 'Lliga Spellbook', 'league', 'public',
    'Liga abierta para organizar encuentros, compartir reglas y conversar sobre Old School y formatos construidos.',
    'https://oldschool.cat/', 'Barcelona', array['modern'], (select id from seed_target_user), now() - interval '80 days'
  ),
  (
    'd0000000-0000-4000-8000-000000000002', 'equip-arcane', 'Equip Arcane', 'team', 'private',
    'Equipo privado de pruebas, preparación de torneos y revisión conjunta de listas.',
    null, 'Catalunya', array['commander', 'pioneer'], '11111111-1111-4111-8111-111111111111', now() - interval '45 days'
  )
on conflict (id) do update
set name = excluded.name,
    kind = excluded.kind,
    access = excluded.access,
    description = excluded.description,
    website_url = excluded.website_url,
    location = excluded.location,
    formats = excluded.formats;

insert into public.organization_members (organization_id, user_id, role, joined_at)
select 'd0000000-0000-4000-8000-000000000001', id, 'owner', now() - interval '80 days'
from seed_target_user
on conflict (organization_id, user_id) do update set role = excluded.role;

insert into public.organization_members (organization_id, user_id, role, joined_at)
values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'admin', now() - interval '70 days'),
  ('d0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'member', now() - interval '63 days'),
  ('d0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'member', now() - interval '51 days'),
  ('d0000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'member', now() - interval '39 days'),
  ('d0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'owner', now() - interval '45 days'),
  ('d0000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'member', now() - interval '30 days')
on conflict (organization_id, user_id) do update set role = excluded.role;

insert into public.organization_join_requests (
  id, organization_id, requester_id, message, status, created_at, updated_at
)
values (
  'd1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
  '55555555-5555-4555-8555-555555555555', 'Me gustaría participar en las sesiones de pruebas de Pioneer.',
  'pending', now() - interval '1 day', now() - interval '1 day'
)
on conflict (id) do update set message = excluded.message, status = excluded.status, reviewed_by = null, reviewed_at = null;

insert into public.organization_forum_topics (
  id, organization_id, author_id, title, body, is_pinned, last_activity_at, created_at, updated_at
)
values
  (
    'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 'Presentaciones y primeras partidas',
    'Usa este tema para presentarte, contar qué formatos juegas y encontrar mesa para la próxima jornada.', true,
    now() - interval '5 hours', now() - interval '20 days', now() - interval '20 days'
  ),
  (
    'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222', 'Preparación del encuentro mensual',
    '¿Qué mazos queréis probar y cuántas rondas os gustaría jugar este mes?', false,
    now() - interval '2 hours', now() - interval '3 days', now() - interval '3 days'
  ),
  (
    'e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333', 'Banco de pruebas de Pioneer',
    'Dejad aquí los emparejamientos que queréis preparar esta semana.', false,
    now() - interval '1 day', now() - interval '8 days', now() - interval '8 days'
  )
on conflict (id) do update set title = excluded.title, body = excluded.body, is_pinned = excluded.is_pinned;

insert into public.organization_forum_messages (id, topic_id, author_id, body, created_at, updated_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'Juego Commander y me gustaría probar Old School con proxies.', now() - interval '5 hours', now() - interval '5 hours'),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'Yo puedo llevar dos barajas y ayudar con las rondas.', now() - interval '2 hours', now() - interval '2 hours')
on conflict (id) do update set body = excluded.body;

insert into public.organization_announcements (
  id, organization_id, author_id, title, body, is_pinned, published_at, created_at, updated_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 'Próxima jornada abierta',
    'Nos encontraremos el sábado a las 10:00. Traed una lista, dados y ganas de compartir partidas.', true,
    now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
  ),
  (
    'a1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 'Normas de convivencia',
    'Confirmad el nivel de las listas antes de empezar y avisad a organización ante cualquier incidencia.', false,
    now() - interval '10 days', now() - interval '10 days', now() - interval '10 days'
  ),
  (
    'a1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111', 'Sesión privada del jueves',
    'Revisaremos banquillos y jugaremos dos rondas cronometradas.', true,
    now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'
  )
on conflict (id) do update set title = excluded.title, body = excluded.body, is_pinned = excluded.is_pinned;

commit;
