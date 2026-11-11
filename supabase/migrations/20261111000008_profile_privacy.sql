-- Separate public and private profile information.
-- Anyone who can see a profile can read its public columns. Private settings (travel
-- preferences, the places someone watches, onboarding state) are readable only by their
-- owner, through get_my_profile().
--
-- Apply AFTER the app version that reads profiles through get_my_profile() is deployed:
-- older clients select profiles.* and would fail once these columns are hidden.

revoke select on public.profiles from anon, authenticated;
grant select (id, handle, name, home, bio, hue, avatar_url, styles, visited, socials, visibility, role, xp, created_at)
  on public.profiles to anon, authenticated;
