-- Hardening after the Supabase security advisor review.
-- Helpers used inside row-level-security policies were in the exposed `public` schema, so
-- anyone could call them over the REST API (e.g. blocked_by(x) revealed whether x blocked you).
-- They now live in a `private` schema that PostgREST does not expose.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'));
$$;

create function private.is_blocked(author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = author);
$$;

create function private.blocked_by(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where blocker_id = other and blocked_id = auth.uid());
$$;

revoke all on function private.is_moderator(), private.is_blocked(uuid), private.blocked_by(uuid) from public;
grant execute on function private.is_moderator(), private.is_blocked(uuid), private.blocked_by(uuid) to anon, authenticated;

alter policy "profiles are visible unless private" on public.profiles
  using (visibility = 'public' or id = auth.uid() or private.is_moderator());
alter policy "published events are public" on public.events
  using (status = 'published' or private.is_moderator());
alter policy "published gems are visible" on public.gems
  using ((status = 'published' and not private.is_blocked(author_id)) or author_id = auth.uid() or private.is_moderator());
alter policy "authors and moderators delete gems" on public.gems
  using (author_id = auth.uid() or private.is_moderator());
alter policy "published tips are visible" on public.tips
  using ((status = 'published' and not private.is_blocked(author_id)) or author_id = auth.uid() or private.is_moderator());
alter policy "authors and moderators delete tips" on public.tips
  using (author_id = auth.uid() or private.is_moderator());
alter policy "follow public profiles" on public.follows
  with check (follower_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = followee_id and p.visibility = 'public')
    and not private.blocked_by(followee_id));
alter policy "see own reports; moderators see all" on public.reports
  using (reporter_id = auth.uid() or private.is_moderator());
alter policy "moderators see the log" on public.moderation_actions
  using (private.is_moderator());

-- No longer referenced by policies; remove them from the API surface.
drop function public.is_blocked(uuid);
drop function public.blocked_by(uuid);
-- public.is_moderator() is still used inside other server functions, but clients don't need it.
revoke execute on function public.is_moderator() from anon, authenticated;

alter function public.report_hide_threshold() set search_path = '';
