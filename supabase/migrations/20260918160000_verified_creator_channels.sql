create type public.creator_platform as enum ('youtube', 'twitch');

create table public.creator_channels (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform public.creator_platform not null,
  external_id text not null,
  channel_url text not null,
  channel_name text not null,
  verified_at timestamptz not null default now(),
  auto_publish boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, platform),
  unique (platform, external_id)
);

create index creator_channels_active_idx on public.creator_channels(platform, auto_publish)
  where auto_publish = true;

create trigger creator_channels_set_updated_at before update on public.creator_channels
for each row execute function public.set_updated_at();

alter table public.creator_channels enable row level security;

create policy "verified creator channels are public"
on public.creator_channels for select
using (verified_at is not null);

create policy "users view own creator channels"
on public.creator_channels for select to authenticated
using ((select auth.uid()) = profile_id);

create policy "users connect own creator channels"
on public.creator_channels for insert to authenticated
with check ((select auth.uid()) = profile_id);

create policy "users update own creator channels"
on public.creator_channels for update to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

create policy "users remove own creator channels"
on public.creator_channels for delete to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.creator_channels to anon, authenticated;
grant insert, update, delete on public.creator_channels to authenticated;
