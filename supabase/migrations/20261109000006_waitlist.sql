-- Early-access waitlist shared by the marketing site (discoverorbis.com) and the app.
-- Rows are written only through public.join_waitlist(), which validates input, drops bot
-- submissions and rate-limits. Nobody can read the table through the API; view it in the
-- Supabase Table Editor.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  first_name text check (first_name is null or char_length(first_name) between 1 and 60),
  interests text[] not null default '{}' check (cardinality(interests) <= 13),
  note text check (note is null or char_length(note) <= 280),
  source text not null default 'website' check (source ~ '^[a-z0-9_.-]{1,40}$'),
  utm jsonb not null default '{}',
  referrer text check (referrer is null or char_length(referrer) <= 200),
  locale text check (locale is null or locale ~ '^[a-zA-Z-]{2,10}$'),
  consent_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index waitlist_signups_email_key on public.waitlist_signups (lower(email));
create index waitlist_signups_created_idx on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from anon, authenticated;
comment on table public.waitlist_signups is 'Early-access signups. Written only by join_waitlist(); not readable through the API.';

-- Attempt log for rate limiting. Stores only a salted hash of the client IP, never the IP.
create table private.waitlist_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index waitlist_attempts_idx on private.waitlist_attempts (ip_hash, created_at);
revoke all on private.waitlist_attempts from public, anon, authenticated;

create function public.join_waitlist(
  p_email text,
  p_first_name text default null,
  p_interests text[] default '{}',
  p_note text default null,
  p_source text default 'website',
  p_utm jsonb default '{}',
  p_referrer text default null,
  p_locale text default null,
  p_website text default null -- honeypot: real people never fill this in
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  allowed constant text[] := array['hidden_gems', 'events', 'travel_buddies', 'itineraries', 'food', 'culture',
    'adventure', 'photography', 'nightlife', 'wellness', 'sports', 'tech', 'fashion'];
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_first_name, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ip text;
  v_hash text;
  v_id uuid;
begin
  -- Bots that fill the hidden field get a normal-looking answer and nothing is stored.
  if coalesce(btrim(p_website), '') <> '' then
    return jsonb_build_object('status', 'joined');
  end if;

  -- Rate limits: 8 attempts per visitor per hour, 500 per hour overall.
  v_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', 'unknown'), ',', 1);
  v_hash := encode(digest(btrim(v_ip) || ':orbis-waitlist:' || to_char(now(), 'YYYY-MM-DD'), 'sha256'), 'hex');
  delete from private.waitlist_attempts where created_at < now() - interval '1 day';
  if (select count(*) from private.waitlist_attempts where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 8
     or (select count(*) from private.waitlist_attempts where created_at > now() - interval '1 hour') >= 500 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into private.waitlist_attempts (ip_hash) values (v_hash);

  if char_length(v_email) > 254 or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;
  if (v_name is not null and char_length(v_name) > 60) or (v_note is not null and char_length(v_note) > 280)
     or public.needs_review(coalesce(v_name, '')) then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.waitlist_signups (email, first_name, interests, note, source, utm, referrer, locale, user_id)
  values (
    v_email,
    v_name,
    coalesce((select array_agg(distinct i) from unnest(coalesce(p_interests, '{}')) i where i = any (allowed)), '{}'),
    v_note,
    case when coalesce(p_source, '') ~ '^[a-z0-9_.-]{1,40}$' then p_source else 'website' end,
    coalesce((select jsonb_object_agg(k, left(v, 100)) from jsonb_each_text(case when jsonb_typeof(p_utm) = 'object' then p_utm else '{}' end) as e(k, v)
              where k in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content')), '{}'),
    left(nullif(btrim(coalesce(p_referrer, '')), ''), 200),
    case when coalesce(p_locale, '') ~ '^[a-zA-Z-]{2,10}$' then p_locale end,
    (select u.id from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = v_email limit 1)
  )
  on conflict ((lower(email))) do nothing
  returning id into v_id;

  return jsonb_build_object('status', case when v_id is null then 'already_joined' else 'joined' end);
end $$;

revoke all on function public.join_waitlist(text, text, text[], text, text, jsonb, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text[], text, text, jsonb, text, text, text) to anon, authenticated;

-- When someone who joined the waitlist creates an app account, connect the two.
create function public.link_waitlist_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.waitlist_signups set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null
    and exists (select 1 from public.profiles where id = new.id);
  return new;
end $$;
revoke execute on function public.link_waitlist_signup() from public, anon, authenticated;

-- Runs after on_auth_user_created (triggers fire in name order), so the profile exists.
create trigger on_auth_user_link_waitlist after insert on auth.users
  for each row execute function public.link_waitlist_signup();
