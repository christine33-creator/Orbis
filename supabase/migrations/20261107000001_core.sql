-- Orbis core schema: profiles, destinations, hidden gems, events, saves, trips, field notes.
-- Security model: every table has row level security. Clients use the anon key; anything
-- that must not be forged (XP, counters, moderation status) is written only by triggers
-- and security-definer functions.

create extension if not exists pgcrypto;

create type public.content_status as enum ('pending', 'published', 'hidden', 'rejected');
create type public.user_role as enum ('member', 'moderator', 'admin');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  name text not null default '' check (char_length(name) <= 80),
  home text not null default '' check (char_length(home) <= 80),
  bio text not null default '' check (char_length(bio) <= 300),
  hue int not null default 20 check (hue between 0 and 359),
  styles text[] not null default '{}',
  preferences jsonb not null default '{}',
  visited text[] not null default '{}',
  watching text[] not null default '{}',
  socials jsonb not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  onboarded boolean not null default false,
  role public.user_role not null default 'member',
  xp int not null default 0,
  created_at timestamptz not null default now()
);

-- Create a profile row whenever someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle, name)
  values (new.id, 'explorer_' || substr(replace(new.id::text, '-', ''), 1, 10), '');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'));
$$;

-- ---------------------------------------------------------------------------
-- Blocks (needed by visibility policies below)
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create function public.is_blocked(author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = author);
$$;

-- True when `other` has blocked the current user (the blocks table itself is private).
create function public.blocked_by(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = other and blocked_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Destinations (curated by admins)
-- ---------------------------------------------------------------------------
create table public.destinations (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  country text not null,
  region text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  hidden_gem boolean not null default false,
  popularity int not null default 50 check (popularity between 0 and 100),
  styles text[] not null default '{}',
  tagline text not null default '',
  description text not null default '',
  best_time text not null default '',
  scene jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Hidden gems (community submitted)
-- ---------------------------------------------------------------------------
create table public.gems (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  destination_id text references public.destinations (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  description text not null check (char_length(description) between 10 and 1000),
  tip text not null default '' check (char_length(tip) <= 500),
  category text not null default 'other'
    check (category in ('viewpoint', 'food', 'nature', 'beach', 'culture', 'shop', 'experience', 'other')),
  styles text[] not null default '{}',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  country text not null default '',
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  status public.content_status not null default 'published',
  upvote_count int not null default 0,
  save_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gems_destination_idx on public.gems (destination_id) where status = 'published';
create index gems_author_idx on public.gems (author_id);
create index gems_status_idx on public.gems (status);

create table public.gem_upvotes (
  gem_id uuid not null references public.gems (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gem_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Field notes (short tips attached to a destination)
-- ---------------------------------------------------------------------------
create table public.tips (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  destination_id text not null references public.destinations (id) on delete cascade,
  category text not null default 'Local secret' check (char_length(category) <= 30),
  body text not null check (char_length(body) between 10 and 500),
  status public.content_status not null default 'published',
  vote_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index tips_destination_idx on public.tips (destination_id) where status = 'published';

create table public.tip_votes (
  tip_id uuid not null references public.tips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  primary key (tip_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Global Pulse events (editorial or synced from event APIs)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  destination_id text references public.destinations (id) on delete set null,
  city text not null,
  category text not null check (category in ('sports', 'tech', 'fashion', 'art', 'music', 'food', 'festival', 'other')),
  title text not null,
  summary text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  url text check (url is null or url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  lat double precision,
  lng double precision,
  source text not null default 'editorial',
  external_id text,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index events_starts_idx on public.events (starts_at);

-- ---------------------------------------------------------------------------
-- Saves (the bridge between discovery and planning)
-- ---------------------------------------------------------------------------
create table public.saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('destination', 'gem', 'event')),
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  destination_id text references public.destinations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  style text not null default 'custom' check (style in ('vacation', 'culture', 'adventure', 'sports', 'events', 'custom')),
  start_date date,
  days int not null default 3 check (days between 1 and 30),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_user_idx on public.trips (user_id);

create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day int not null default 0 check (day between 0 and 29),
  position int not null default 0,
  time text check (time is null or time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 1000),
  item_type text check (item_type in ('destination', 'gem', 'event')),
  item_id text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index trip_items_trip_idx on public.trip_items (trip_id, day, position);

-- ---------------------------------------------------------------------------
-- Following (P1)
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);
