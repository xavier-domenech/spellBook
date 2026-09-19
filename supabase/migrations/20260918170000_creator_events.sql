create table public.creator_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.creator_channels(id) on delete cascade,
  platform public.creator_platform not null,
  external_event_id text not null,
  title text not null,
  content_url text not null,
  published_at timestamptz,
  post_id uuid references public.posts(id) on delete set null,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (platform, external_event_id)
);

create index creator_events_pending_idx on public.creator_events(channel_id, processed_at)
  where processed_at is null;

alter table public.creator_events enable row level security;
revoke all on public.creator_events from anon, authenticated;

create policy "users view own creator events"
on public.creator_events for select to authenticated
using (exists (
  select 1 from public.creator_channels
  where creator_channels.id = creator_events.channel_id
    and creator_channels.profile_id = (select auth.uid())
));

grant select on public.creator_events to authenticated;
