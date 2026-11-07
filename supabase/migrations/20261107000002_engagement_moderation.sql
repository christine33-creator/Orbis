-- XP, rate limits, content screening, reports and moderation.

-- ---------------------------------------------------------------------------
-- XP ledger. Only security-definer code inserts here; profiles.xp is derived.
-- ---------------------------------------------------------------------------
create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null check (amount > 0),
  reason text not null,
  ref text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

-- Award XP once per (user, reason, ref), within a daily cap per reason.
create function public.award_xp(target uuid, amount int, reason text, ref text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  daily_cap int := case reason
    when 'gem_published' then 500
    when 'tip_published' then 400
    when 'upvote_received' then 200
    when 'saved' then 50
    when 'trip_created' then 180
    when 'stop_done' then 150
    when 'followed' then 50
    when 'country_stamped' then 300
    else 1000 end;
  today int;
begin
  if target is null then return; end if;
  select coalesce(sum(x.amount), 0) into today from public.xp_events x
    where x.user_id = target and x.reason = award_xp.reason and x.created_at > now() - interval '1 day';
  if today + amount > daily_cap then return; end if;
  insert into public.xp_events (user_id, amount, reason, ref)
    values (target, amount, reason, coalesce(ref, ''))
    on conflict do nothing;
end $$;
revoke all on function public.award_xp(uuid, int, text, text) from public, anon, authenticated;

create function public.xp_events_apply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set xp = xp + new.amount where id = new.user_id;
  return new;
end $$;
create trigger xp_events_apply after insert on public.xp_events
  for each row execute function public.xp_events_apply();

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
create function public.enforce_rate_limit(tbl regclass, owner_col text, max_per_day int)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.is_moderator() then return; end if;
  execute format('select count(*) from %s where %I = $1 and created_at > now() - interval ''1 day''', tbl, owner_col)
    into n using auth.uid();
  if n >= max_per_day then
    raise exception 'Daily limit reached. Please try again tomorrow.' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Content screening: flagged text is held for review instead of published.
-- Admins manage the term list in the dashboard.
-- ---------------------------------------------------------------------------
create table public.blocked_terms (term text primary key check (char_length(term) >= 3));

create function public.needs_review(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(t, '') ~* '(https?://|www\.)'                                  -- links are a spam vector
      or coalesce(t, '') ~ '[0-9][0-9 ().+-]{8,}[0-9]'                          -- phone numbers
      or coalesce(t, '') ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'             -- email addresses
      or exists (select 1 from public.blocked_terms b where coalesce(t, '') ilike '%' || b.term || '%');
$$;

-- ---------------------------------------------------------------------------
-- Gem triggers
-- ---------------------------------------------------------------------------
create function public.gems_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.gems', 'author_id', 10);
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.upvote_count := 0; new.save_count := 0; new.report_count := 0;
    new.status := case when public.needs_review(new.name || ' ' || new.description || ' ' || new.tip)
                       then 'pending' else 'published' end;
  elsif (new.name, new.description, new.tip) is distinct from (old.name, old.description, old.tip)
        and new.status = 'published'
        and public.needs_review(new.name || ' ' || new.description || ' ' || new.tip) then
    new.status := 'pending';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger gems_before_write before insert or update on public.gems
  for each row execute function public.gems_before_write();

create function public.gems_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform public.award_xp(new.author_id, 50, 'gem_published', new.id::text);
  end if;
  return new;
end $$;
create trigger gems_after_write after insert or update of status on public.gems
  for each row execute function public.gems_after_write();

create function public.gem_upvotes_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_op = 'INSERT' then
    select author_id into author from public.gems where id = new.gem_id;
    if author = new.user_id then raise exception 'You cannot upvote your own gem.' using errcode = 'P0001'; end if;
    update public.gems set upvote_count = upvote_count + 1 where id = new.gem_id;
    perform public.award_xp(author, 2, 'upvote_received', new.gem_id::text || ':' || new.user_id::text);
    return new;
  else
    update public.gems set upvote_count = greatest(upvote_count - 1, 0) where id = old.gem_id;
    return old;
  end if;
end $$;
create trigger gem_upvotes_count after insert or delete on public.gem_upvotes
  for each row execute function public.gem_upvotes_count();

-- ---------------------------------------------------------------------------
-- Tip (field note) triggers
-- ---------------------------------------------------------------------------
create function public.tips_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.tips', 'author_id', 20);
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.vote_count := 0; new.report_count := 0;
    new.status := case when public.needs_review(new.body) then 'pending' else 'published' end;
  elsif new.body is distinct from old.body and new.status = 'published' and public.needs_review(new.body) then
    new.status := 'pending';
  end if;
  return new;
end $$;
create trigger tips_before_write before insert or update on public.tips
  for each row execute function public.tips_before_write();

create function public.tips_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform public.award_xp(new.author_id, 40, 'tip_published', new.id::text);
  end if;
  return new;
end $$;
create trigger tips_after_write after insert or update of status on public.tips
  for each row execute function public.tips_after_write();

create function public.tip_votes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.tips where id = new.tip_id and author_id = new.user_id) then
      raise exception 'You cannot vote for your own note.' using errcode = 'P0001';
    end if;
    update public.tips set vote_count = vote_count + 1 where id = new.tip_id;
    return new;
  else
    update public.tips set vote_count = greatest(vote_count - 1, 0) where id = old.tip_id;
    return old;
  end if;
end $$;
create trigger tip_votes_count after insert or delete on public.tip_votes
  for each row execute function public.tip_votes_count();

-- ---------------------------------------------------------------------------
-- Saves, trips, follows, profile XP hooks
-- ---------------------------------------------------------------------------
create function public.saves_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.item_type = 'gem' then
      update public.gems set save_count = save_count + 1 where id::text = new.item_id;
    end if;
    perform public.award_xp(new.user_id, 5, 'saved', new.item_type || ':' || new.item_id);
    return new;
  else
    if old.item_type = 'gem' then
      update public.gems set save_count = greatest(save_count - 1, 0) where id::text = old.item_id;
    end if;
    return old;
  end if;
end $$;
create trigger saves_after_write after insert or delete on public.saves
  for each row execute function public.saves_after_write();

create function public.saves_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('public.saves', 'user_id', 300);
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end $$;
create trigger saves_before_insert before insert on public.saves
  for each row execute function public.saves_before_insert();

create function public.trips_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.trips', 'user_id', 20);
    new.user_id := coalesce(auth.uid(), new.user_id);
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trips_before_write before insert or update on public.trips
  for each row execute function public.trips_before_write();

create function public.trips_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_xp(new.user_id, 60, 'trip_created', new.id::text);
  return new;
end $$;
create trigger trips_after_insert after insert on public.trips
  for each row execute function public.trips_after_insert();

create function public.trip_items_after_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.done and not old.done then
    perform public.award_xp((select user_id from public.trips where id = new.trip_id), 15, 'stop_done', new.id::text);
  end if;
  return new;
end $$;
create trigger trip_items_after_done after update of done on public.trip_items
  for each row execute function public.trip_items_after_done();

create function public.trip_items_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trip_items where trip_id = new.trip_id) >= 300 then
    raise exception 'This trip has too many stops.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trip_items_limit before insert on public.trip_items
  for each row execute function public.trip_items_limit();

create function public.follows_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('public.follows', 'follower_id', 200);
  new.follower_id := coalesce(auth.uid(), new.follower_id);
  return new;
end $$;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

create function public.follows_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_xp(new.follower_id, 5, 'followed', new.followee_id::text);
  return new;
end $$;
create trigger follows_after_insert after insert on public.follows
  for each row execute function public.follows_after_insert();

create function public.profiles_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if new.onboarded and not old.onboarded then
    perform public.award_xp(new.id, 100, 'profile_completed', '');
  end if;
  foreach c in array coalesce(new.visited, '{}') loop
    if not (c = any (coalesce(old.visited, '{}'))) then
      perform public.award_xp(new.id, 15, 'country_stamped', c);
    end if;
  end loop;
  return new;
end $$;
create trigger profiles_after_update after update of onboarded, visited on public.profiles
  for each row execute function public.profiles_after_update();

-- ---------------------------------------------------------------------------
-- Reports & moderation
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('gem', 'tip', 'profile', 'event')),
  target_id text not null,
  reason text not null check (reason in ('spam', 'inappropriate', 'unsafe', 'inaccurate', 'harassment', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open_idx on public.reports (status, created_at) where status = 'open';

-- Number of independent reports that hides content until a moderator reviews it.
create function public.report_hide_threshold() returns int language sql immutable as $$ select 3 $$;

create function public.reports_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('public.reports', 'reporter_id', 30);
  new.reporter_id := coalesce(auth.uid(), new.reporter_id);
  new.status := 'open'; new.resolved_by := null; new.resolved_at := null;
  return new;
end $$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

create function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'gem' then
    update public.gems set report_count = report_count + 1,
      status = case when report_count + 1 >= public.report_hide_threshold() and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  elsif new.target_type = 'tip' then
    update public.tips set report_count = report_count + 1,
      status = case when report_count + 1 >= public.report_hide_threshold() and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  end if;
  return new;
end $$;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  moderator_id uuid references public.profiles (id) on delete set null,
  target_type text not null,
  target_id text not null,
  action text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Moderators set the status of a gem or tip and close its open reports.
create function public.moderate(target_type text, target_id uuid, new_status public.content_status, note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can do this.' using errcode = '42501';
  end if;
  if target_type = 'gem' then
    update public.gems set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end
      where id = target_id;
  elsif target_type = 'tip' then
    update public.tips set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end
      where id = target_id;
  else
    raise exception 'Unknown target type %', target_type;
  end if;
  update public.reports set status = case when new_status = 'published' then 'dismissed' else 'resolved' end,
    resolved_by = auth.uid(), resolved_at = now()
    where reports.target_type = moderate.target_type and reports.target_id = moderate.target_id::text and status = 'open';
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, note)
    values (auth.uid(), target_type, target_id::text, new_status::text, coalesce(note, ''));
end $$;

create function public.resolve_report(report_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can do this.' using errcode = '42501';
  end if;
  if new_status not in ('resolved', 'dismissed') then raise exception 'Invalid status'; end if;
  update public.reports set status = new_status, resolved_by = auth.uid(), resolved_at = now() where id = report_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action)
    values (auth.uid(), 'report', report_id::text, new_status);
end $$;

-- Lets someone permanently delete their own account and everything they created.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

create function public.handle_available(candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select candidate ~ '^[a-z0-9_.]{3,30}$'
     and not exists (select 1 from public.profiles where handle = candidate and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'));
$$;
