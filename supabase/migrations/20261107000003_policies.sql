-- Row level security and grants. Anonymous visitors can browse published content;
-- writing anything requires a signed-in account.

alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.destinations enable row level security;
alter table public.gems enable row level security;
alter table public.gem_upvotes enable row level security;
alter table public.tips enable row level security;
alter table public.tip_votes enable row level security;
alter table public.events enable row level security;
alter table public.saves enable row level security;
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.follows enable row level security;
alter table public.xp_events enable row level security;
alter table public.blocked_terms enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

-- Start from nothing, then grant exactly what the app needs.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.destinations, public.events, public.gems, public.tips, public.profiles to anon, authenticated;

grant update (handle, name, home, bio, hue, styles, preferences, visited, watching, socials, visibility, onboarded)
  on public.profiles to authenticated;
grant insert, delete on public.gems to authenticated;
grant update (destination_id, name, description, tip, category, styles, lat, lng, country, photos) on public.gems to authenticated;
grant select, insert, delete on public.gem_upvotes to authenticated;
grant insert, delete on public.tips to authenticated;
grant update (category, body) on public.tips to authenticated;
grant select, insert, delete on public.tip_votes to authenticated;
grant select, insert, delete on public.saves to authenticated;
grant select, insert, update, delete on public.trips, public.trip_items to authenticated;
grant select, insert, delete on public.follows, public.blocks to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.xp_events, public.moderation_actions to authenticated;

grant execute on function public.is_moderator(), public.is_blocked(uuid), public.blocked_by(uuid), public.handle_available(text) to anon, authenticated;
grant execute on function public.moderate(text, uuid, public.content_status, text),
  public.resolve_report(uuid, text), public.delete_my_account() to authenticated;

-- Profiles
create policy "profiles are visible unless private" on public.profiles for select
  using (visibility = 'public' or id = auth.uid() or public.is_moderator());
create policy "people edit their own profile" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Destinations & events
create policy "destinations are public" on public.destinations for select using (true);
create policy "published events are public" on public.events for select
  using (status = 'published' or public.is_moderator());

-- Gems
create policy "published gems are visible" on public.gems for select
  using ((status = 'published' and not public.is_blocked(author_id)) or author_id = auth.uid() or public.is_moderator());
create policy "signed-in people share gems" on public.gems for insert to authenticated
  with check (author_id = auth.uid());
create policy "authors edit their gems" on public.gems for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors and moderators delete gems" on public.gems for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

create policy "see own upvotes" on public.gem_upvotes for select to authenticated using (user_id = auth.uid());
create policy "upvote published gems" on public.gem_upvotes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.gems g where g.id = gem_id and g.status = 'published'));
create policy "remove own upvote" on public.gem_upvotes for delete to authenticated using (user_id = auth.uid());

-- Tips
create policy "published tips are visible" on public.tips for select
  using ((status = 'published' and not public.is_blocked(author_id)) or author_id = auth.uid() or public.is_moderator());
create policy "signed-in people add tips" on public.tips for insert to authenticated with check (author_id = auth.uid());
create policy "authors edit tips" on public.tips for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors and moderators delete tips" on public.tips for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

create policy "see own tip votes" on public.tip_votes for select to authenticated using (user_id = auth.uid());
create policy "vote on published tips" on public.tip_votes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.tips t where t.id = tip_id and t.status = 'published'));
create policy "remove own tip vote" on public.tip_votes for delete to authenticated using (user_id = auth.uid());

-- Saves, trips
create policy "own saves" on public.saves for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own trips" on public.trips for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own trip items" on public.trip_items for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));

-- Follows & blocks
create policy "follows are visible to members" on public.follows for select to authenticated using (true);
create policy "follow public profiles" on public.follows for insert to authenticated
  with check (follower_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = followee_id and p.visibility = 'public')
    and not public.blocked_by(followee_id));
create policy "unfollow" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "own blocks" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- XP, reports, moderation
create policy "own xp history" on public.xp_events for select to authenticated using (user_id = auth.uid());
create policy "file reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "see own reports; moderators see all" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy "moderators see the log" on public.moderation_actions for select to authenticated
  using (public.is_moderator());
