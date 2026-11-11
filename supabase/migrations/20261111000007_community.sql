-- Community: communities, memberships, posts with photos, comments, likes and saved posts,
-- plus profile photos, follow visibility, and reporting/moderation for the new content.
-- Same security model as the rest of the schema: RLS on every table, and anything that must
-- not be forged (authorship, roles, counters, status, XP) is set by triggers or definer functions.

-- ---------------------------------------------------------------------------
-- Policy helpers (private schema: not callable through the API)
-- ---------------------------------------------------------------------------
create function private.can_view_profile(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p and (visibility = 'public' or id = auth.uid()))
      or private.is_moderator();
$$;

-- ---------------------------------------------------------------------------
-- Profile photos
-- ---------------------------------------------------------------------------
alter table public.profiles add column avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500);
grant update (avatar_url) on public.profiles to authenticated;

-- A profile photo must be a file in the owner's own folder of the avatars bucket.
create function public.profiles_check_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is not null and (new.avatar_url !~ '^https://'
      or position('/storage/v1/object/public/avatars/' || new.id::text || '/' in new.avatar_url) = 0) then
    raise exception 'Invalid profile photo.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger profiles_check_avatar before insert or update of avatar_url on public.profiles
  for each row execute function public.profiles_check_avatar();

-- Full row (including private settings) for the signed-in person only.
create function public.get_my_profile() returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select * from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(btrim(name)) between 3 and 60),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'interest' check (category in ('place', 'interest', 'people')),
  destination_id text references public.destinations (id) on delete set null,
  country text not null default '' check (char_length(country) <= 80),
  styles text[] not null default '{}' check (cardinality(styles) <= 6),
  hue int not null default 20 check (hue between 0 and 359),
  official boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  status public.content_status not null default 'published',
  member_count int not null default 0,
  post_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index communities_name_key on public.communities (lower(btrim(name)));
create index communities_status_idx on public.communities (status, member_count desc);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);

create function private.community_role(c uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.community_members where community_id = c and user_id = auth.uid();
$$;
create function private.is_member(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_members where community_id = c and user_id = auth.uid());
$$;
create function private.is_community_mod(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.community_members where community_id = c and user_id = auth.uid() and role in ('owner', 'moderator'));
$$;

create function public.communities_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text;
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.communities', 'created_by', 3);
    if auth.uid() is not null then
      new.created_by := auth.uid();
      if not public.is_moderator() then new.official := false; end if;
    end if;
    new.member_count := 0; new.post_count := 0; new.report_count := 0;
    new.name := btrim(new.name);
    -- Readable, unique address made from the name.
    base := btrim(regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'), '-');
    if char_length(base) < 3 then base := 'community'; end if;
    new.slug := left(base, 48);
    while exists (select 1 from public.communities where slug = new.slug) loop
      new.slug := left(base, 48) || '-' || substr(md5(random()::text), 1, 5);
    end loop;
    new.status := case when public.needs_review(new.name || ' ' || new.description) then 'pending' else 'published' end;
  else
    new.name := btrim(new.name);
    if (new.name, new.description) is distinct from (old.name, old.description) and new.status = 'published'
       and public.needs_review(new.name || ' ' || new.description) then
      new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger communities_before_write before insert or update on public.communities
  for each row execute function public.communities_before_write();

-- The creator becomes the owner.
create function public.communities_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.community_members (community_id, user_id, role) values (new.id, new.created_by, 'owner');
    perform public.award_xp(new.created_by, 30, 'community_created', new.id::text);
  end if;
  return new;
end $$;
create trigger communities_after_insert after insert on public.communities
  for each row execute function public.communities_after_insert();

-- Joining always makes you a plain member. Roles change only through set_member_role().
-- (pg_trigger_depth() > 1 means the insert came from another trigger, i.e. community creation.)
create function public.community_members_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() = 1 then
    perform public.enforce_rate_limit('public.community_members', 'user_id', 50);
    new.user_id := coalesce(auth.uid(), new.user_id);
    new.role := 'member';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger community_members_before_insert before insert on public.community_members
  for each row execute function public.community_members_before_insert();

create function public.community_members_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Direct deletes only; cascades (community or account deleted) run at a deeper trigger level.
  if old.role = 'owner' and pg_trigger_depth() = 1 then
    raise exception 'Owners cannot leave their community. Delete it instead.' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger community_members_before_delete before delete on public.community_members
  for each row execute function public.community_members_before_delete();

create function public.community_members_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
    if new.role = 'member' then
      perform public.award_xp(new.user_id, 10, 'community_joined', new.community_id::text);
    end if;
    return new;
  else
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
    return old;
  end if;
end $$;
create trigger community_members_count after insert or delete on public.community_members
  for each row execute function public.community_members_count();

-- Owners promote or demote moderators. Nobody can make themselves (or anyone) an owner.
create function public.set_member_role(p_community uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('member', 'moderator') then raise exception 'Invalid role' using errcode = '22023'; end if;
  if coalesce(private.community_role(p_community), '') <> 'owner' and not public.is_moderator() then
    raise exception 'Only the community owner can change roles.' using errcode = '42501';
  end if;
  update public.community_members set role = p_role
    where community_id = p_community and user_id = p_user and role <> 'owner';
  if not found then raise exception 'That member was not found.' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'discussion' check (kind in ('discussion', 'question', 'recommendation', 'experience')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  destination_id text references public.destinations (id) on delete set null,
  place text not null default '' check (char_length(place) <= 120),
  status public.content_status not null default 'published',
  like_count int not null default 0,
  comment_count int not null default 0,
  save_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);
create index community_posts_feed_idx on public.community_posts (community_id, created_at desc) where status = 'published';
create index community_posts_author_idx on public.community_posts (author_id);
create index community_posts_status_idx on public.community_posts (status) where status <> 'published';

create function private.post_community(p uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select community_id from public.community_posts where id = p;
$$;

create function public.community_posts_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.community_posts', 'author_id', 20);
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.like_count := 0; new.comment_count := 0; new.save_count := 0; new.report_count := 0;
    new.edited_at := null; new.created_at := now();
    new.status := case when public.needs_review(new.title || ' ' || new.body || ' ' || new.place) then 'pending' else 'published' end;
  elsif (new.kind, new.title, new.body, new.destination_id, new.place) is distinct from (old.kind, old.title, old.body, old.destination_id, old.place) then
    new.edited_at := now();
    if new.status = 'published' and public.needs_review(new.title || ' ' || new.body || ' ' || new.place) then
      new.status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger community_posts_before_write before insert or update on public.community_posts
  for each row execute function public.community_posts_before_write();

create function public.community_posts_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare delta int := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then delta := 1; end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'published' and old.status <> 'published' then delta := 1;
    elsif old.status = 'published' and new.status <> 'published' then delta := -1; end if;
  elsif old.status = 'published' then
    delta := -1;
  end if;
  if tg_op <> 'DELETE' and delta = 1 then
    perform public.award_xp(new.author_id, 20, 'post_published', new.id::text);
  end if;
  if delta <> 0 then
    update public.communities set post_count = greatest(post_count + delta, 0)
      where id = case when tg_op = 'DELETE' then old.community_id else new.community_id end;
  end if;
  return null;
end $$;
create trigger community_posts_after_write after insert or delete or update of status on public.community_posts
  for each row execute function public.community_posts_after_write();

-- Photos attached to a post (stored in the community-media bucket).
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  url text not null check (char_length(url) <= 500),
  position int not null default 0 check (position between 0 and 5),
  created_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id, position);

create function public.post_media_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_id := coalesce(auth.uid(), new.author_id);
  if new.url !~ '^https://' or position('/storage/v1/object/public/community-media/' || new.author_id::text || '/' in new.url) = 0 then
    raise exception 'Invalid photo.' using errcode = '23514';
  end if;
  if (select count(*) from public.post_media where post_id = new.post_id) >= 6 then
    raise exception 'A post can have at most 6 photos.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger post_media_before_insert before insert on public.post_media
  for each row execute function public.post_media_before_insert();

-- ---------------------------------------------------------------------------
-- Comments, likes, saved posts
-- ---------------------------------------------------------------------------
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status public.content_status not null default 'published',
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_author_idx on public.post_comments (author_id);

create function public.post_comments_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.post_comments', 'author_id', 100);
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.report_count := 0; new.edited_at := null; new.created_at := now();
    new.status := case when public.needs_review(new.body) then 'pending' else 'published' end;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
    if new.status = 'published' and public.needs_review(new.body) then new.status := 'pending'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger post_comments_before_write before insert or update on public.post_comments
  for each row execute function public.post_comments_before_write();

create function public.post_comments_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare delta int := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then delta := 1; end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'published' and old.status <> 'published' then delta := 1;
    elsif old.status = 'published' and new.status <> 'published' then delta := -1; end if;
  elsif old.status = 'published' then
    delta := -1;
  end if;
  if tg_op = 'INSERT' and delta = 1 then
    perform public.award_xp(new.author_id, 5, 'comment_published', new.id::text);
  end if;
  if delta <> 0 then
    update public.community_posts set comment_count = greatest(comment_count + delta, 0)
      where id = case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  end if;
  return null;
end $$;
create trigger post_comments_after_write after insert or delete or update of status on public.post_comments
  for each row execute function public.post_comments_after_write();

create table public.post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id);

create function public.post_likes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('public.post_likes', 'user_id', 500);
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();
  if exists (select 1 from public.community_posts where id = new.post_id and author_id = new.user_id) then
    raise exception 'You cannot like your own post.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger post_likes_before_insert before insert on public.post_likes
  for each row execute function public.post_likes_before_insert();

create function public.post_likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_op = 'INSERT' then
    update public.community_posts set like_count = like_count + 1 where id = new.post_id returning author_id into author;
    perform public.award_xp(author, 2, 'like_received', new.post_id::text || ':' || new.user_id::text);
    return new;
  else
    update public.community_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.post_likes_count();

create table public.post_saves (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_saves_user_idx on public.post_saves (user_id, created_at desc);

create function public.post_saves_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('public.post_saves', 'user_id', 500);
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();
  return new;
end $$;
create trigger post_saves_before_insert before insert on public.post_saves
  for each row execute function public.post_saves_before_insert();

create function public.post_saves_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set save_count = save_count + 1 where id = new.post_id;
    return new;
  else
    update public.community_posts set save_count = greatest(save_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger post_saves_count after insert or delete on public.post_saves
  for each row execute function public.post_saves_count();

-- ---------------------------------------------------------------------------
-- Community recommendations → hidden gems (always reviewed before they reach Explore)
-- ---------------------------------------------------------------------------
alter table public.gems add column source_post_id uuid references public.community_posts (id) on delete set null;
create unique index gems_source_post_key on public.gems (source_post_id) where source_post_id is not null;

create or replace function public.gems_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit('public.gems', 'author_id', 10);
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.upvote_count := 0; new.save_count := 0; new.report_count := 0;
    new.status := case when public.needs_review(new.name || ' ' || new.description || ' ' || new.tip)
                       then 'pending' else 'published' end;
    if new.source_post_id is not null then
      if not exists (select 1 from public.community_posts p
                     where p.id = new.source_post_id and p.author_id = new.author_id and p.kind = 'recommendation') then
        raise exception 'You can only suggest your own recommendations.' using errcode = 'P0001';
      end if;
      new.status := 'pending';
    end if;
  elsif (new.name, new.description, new.tip) is distinct from (old.name, old.description, old.tip)
        and new.status = 'published'
        and public.needs_review(new.name || ' ' || new.description || ' ' || new.tip) then
    new.status := 'pending';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- XP caps for the new reasons
-- ---------------------------------------------------------------------------
create or replace function public.award_xp(target uuid, amount int, reason text, ref text default '')
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
    when 'post_published' then 100
    when 'comment_published' then 50
    when 'like_received' then 100
    when 'community_joined' then 50
    when 'community_created' then 60
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

-- ---------------------------------------------------------------------------
-- Reports and moderation for communities, posts and comments
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('gem', 'tip', 'profile', 'event', 'community', 'post', 'comment'));

create or replace function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int := public.report_hide_threshold();
begin
  if new.target_type = 'gem' then
    update public.gems set report_count = report_count + 1,
      status = case when report_count + 1 >= lim and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  elsif new.target_type = 'tip' then
    update public.tips set report_count = report_count + 1,
      status = case when report_count + 1 >= lim and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  elsif new.target_type = 'post' then
    update public.community_posts set report_count = report_count + 1,
      status = case when report_count + 1 >= lim and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  elsif new.target_type = 'comment' then
    update public.post_comments set report_count = report_count + 1,
      status = case when report_count + 1 >= lim and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  elsif new.target_type = 'community' then
    update public.communities set report_count = report_count + 1,
      status = case when report_count + 1 >= lim and status = 'published' then 'hidden' else status end
      where id::text = new.target_id;
  end if;
  return new;
end $$;

-- Site moderators can act on everything. Community owners and moderators can hide or restore
-- posts and comments in their own community.
create or replace function public.moderate(target_type text, target_id uuid, new_status public.content_status, note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if target_type = 'post' then
    select community_id into c from public.community_posts where id = target_id;
  elsif target_type = 'comment' then
    select p.community_id into c from public.post_comments m join public.community_posts p on p.id = m.post_id where m.id = target_id;
  end if;
  if not (public.is_moderator() or (c is not null and private.is_community_mod(c))) then
    raise exception 'Only moderators can do this.' using errcode = '42501';
  end if;
  if target_type = 'gem' then
    update public.gems set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end where id = target_id;
  elsif target_type = 'tip' then
    update public.tips set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end where id = target_id;
  elsif target_type = 'post' then
    update public.community_posts set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end where id = target_id;
  elsif target_type = 'comment' then
    update public.post_comments set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end where id = target_id;
  elsif target_type = 'community' then
    update public.communities set status = new_status,
      report_count = case when new_status = 'published' then 0 else report_count end where id = target_id;
  else
    raise exception 'Unknown target type %', target_type;
  end if;
  update public.reports set status = case when new_status = 'published' then 'dismissed' else 'resolved' end,
    resolved_by = auth.uid(), resolved_at = now()
    where reports.target_type = moderate.target_type and reports.target_id = moderate.target_id::text and status = 'open';
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, note)
    values (auth.uid(), target_type, target_id::text, new_status::text, coalesce(note, ''));
end $$;

-- ---------------------------------------------------------------------------
-- Public profile numbers (no identities), only for profiles the caller can see
-- ---------------------------------------------------------------------------
create function public.profile_stats(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when private.can_view_profile(p) then jsonb_build_object(
    'followers', (select count(*) from public.follows where followee_id = p),
    'following', (select count(*) from public.follows where follower_id = p),
    'gems', (select count(*) from public.gems where author_id = p and status = 'published'),
    'posts', (select count(*) from public.community_posts x join public.communities c on c.id = x.community_id
              where x.author_id = p and x.status = 'published' and c.status = 'published'),
    'communities', (select count(*) from public.community_members m join public.communities c on c.id = m.community_id
                    where m.user_id = p and c.status = 'published')
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;

revoke all on public.communities, public.community_members, public.community_posts, public.post_media,
  public.post_comments, public.post_likes, public.post_saves from anon, authenticated;

grant select on public.communities, public.community_members, public.community_posts, public.post_media, public.post_comments to anon, authenticated;
grant insert (name, description, category, destination_id, country, styles, hue) on public.communities to authenticated;
grant update (name, description, category, destination_id, country, styles, hue) on public.communities to authenticated;
grant delete on public.communities to authenticated;
grant insert (community_id), delete on public.community_members to authenticated;
grant insert (community_id, kind, title, body, destination_id, place) on public.community_posts to authenticated;
grant update (kind, title, body, destination_id, place) on public.community_posts to authenticated;
grant delete on public.community_posts to authenticated;
grant insert (post_id, url, position), delete on public.post_media to authenticated;
grant insert (post_id, body) on public.post_comments to authenticated;
grant update (body) on public.post_comments to authenticated;
grant delete on public.post_comments to authenticated;
grant select, insert (post_id), delete on public.post_likes, public.post_saves to authenticated;

-- Communities
create policy "published communities are visible" on public.communities for select
  using (status = 'published' or created_by = auth.uid() or private.is_moderator() or private.is_community_mod(id));
create policy "signed-in people create communities" on public.communities for insert to authenticated
  with check (created_by = auth.uid());
create policy "owners and community moderators edit" on public.communities for update to authenticated
  using (private.is_community_mod(id) or private.is_moderator())
  with check (private.is_community_mod(id) or private.is_moderator());
create policy "owners and moderators delete communities" on public.communities for delete to authenticated
  using (private.community_role(id) = 'owner' or private.is_moderator());

-- Memberships
create policy "memberships of visible people" on public.community_members for select
  using (exists (select 1 from public.communities c where c.id = community_id)
         and (user_id = auth.uid() or private.can_view_profile(user_id)));
create policy "join published communities" on public.community_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'member'
    and exists (select 1 from public.communities c where c.id = community_id and c.status = 'published'));
create policy "leave, or remove members as a moderator" on public.community_members for delete to authenticated
  using (user_id = auth.uid() or private.is_moderator()
    or (role = 'member' and private.is_community_mod(community_id))
    or (role = 'moderator' and private.community_role(community_id) = 'owner'));

-- Posts
create policy "published posts are visible" on public.community_posts for select
  using ((status = 'published' and not private.is_blocked(author_id)
          and exists (select 1 from public.communities c where c.id = community_id and c.status = 'published'))
    or author_id = auth.uid() or private.is_moderator() or private.is_community_mod(community_id));
create policy "members post" on public.community_posts for insert to authenticated
  with check (author_id = auth.uid() and private.is_member(community_id)
    and exists (select 1 from public.communities c where c.id = community_id and c.status = 'published'));
create policy "authors edit posts" on public.community_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors and moderators delete posts" on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or private.is_moderator() or private.is_community_mod(community_id));

-- Post photos follow their post's visibility
create policy "photos of visible posts" on public.post_media for select
  using (exists (select 1 from public.community_posts p where p.id = post_id));
create policy "authors add photos to own posts" on public.post_media for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "authors and moderators remove photos" on public.post_media for delete to authenticated
  using (author_id = auth.uid() or private.is_moderator() or private.is_community_mod(private.post_community(post_id)));

-- Comments
create policy "published comments are visible" on public.post_comments for select
  using ((status = 'published' and not private.is_blocked(author_id)
          and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'))
    or author_id = auth.uid() or private.is_moderator() or private.is_community_mod(private.post_community(post_id)));
create policy "members comment on published posts" on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and private.is_member(private.post_community(post_id))
    and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'));
create policy "authors edit comments" on public.post_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors and moderators delete comments" on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or private.is_moderator() or private.is_community_mod(private.post_community(post_id)));

-- Likes and saved posts: private to their owner
create policy "own likes" on public.post_likes for select to authenticated using (user_id = auth.uid());
create policy "like visible published posts" on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'));
create policy "unlike" on public.post_likes for delete to authenticated using (user_id = auth.uid());
create policy "own saved posts" on public.post_saves for select to authenticated using (user_id = auth.uid());
create policy "save visible posts" on public.post_saves for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.community_posts p where p.id = post_id));
create policy "unsave" on public.post_saves for delete to authenticated using (user_id = auth.uid());

-- Follow edges: your own, or between two people whose profiles you can see.
drop policy "follows are visible to members" on public.follows;
create policy "follows between visible profiles" on public.follows for select
  using (follower_id = auth.uid() or followee_id = auth.uid()
    or (private.can_view_profile(follower_id) and private.can_view_profile(followee_id)));
grant select on public.follows to anon;

-- ---------------------------------------------------------------------------
-- Function privileges: new functions are executable by PUBLIC by default.
-- ---------------------------------------------------------------------------
revoke all on function
  public.profiles_check_avatar(), public.get_my_profile(), public.communities_before_write(), public.communities_after_insert(),
  public.community_members_before_insert(), public.community_members_before_delete(), public.community_members_count(),
  public.set_member_role(uuid, uuid, text), public.community_posts_before_write(), public.community_posts_after_write(),
  public.post_media_before_insert(), public.post_comments_before_write(), public.post_comments_after_write(),
  public.post_likes_before_insert(), public.post_likes_count(), public.post_saves_before_insert(), public.post_saves_count(),
  public.profile_stats(uuid)
  from public, anon, authenticated;
revoke all on function private.can_view_profile(uuid), private.community_role(uuid), private.is_member(uuid),
  private.is_community_mod(uuid), private.post_community(uuid) from public;
grant execute on function private.can_view_profile(uuid), private.community_role(uuid), private.is_member(uuid),
  private.is_community_mod(uuid), private.post_community(uuid) to anon, authenticated;

grant execute on function public.get_my_profile(), public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.profile_stats(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: profile photos and post photos, written only into the owner's folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-media', 'community-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars are public" on storage.objects for select using (bucket_id = 'avatars');
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community media is public" on storage.objects for select using (bucket_id = 'community-media');
create policy "upload own community media" on storage.objects for insert to authenticated
  with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own community media" on storage.objects for delete to authenticated
  using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
