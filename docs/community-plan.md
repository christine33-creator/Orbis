# Community MVP: architecture audit and plan

> Explore helps people discover the world. Community helps them discover the people experiencing it.

## 1. Existing architecture

| Layer | What's there |
| --- | --- |
| App | React 19, TypeScript, Vite, Tailwind 4, TanStack Query, zustand (UI state only), i18next (en, es, fr, pt, de, ja). One mobile shell (`App.tsx`) with tabs and stacked overlay sheets (`store/ui.ts` → `screens/Overlays.tsx`). |
| Data access | `Api` interface (`src/api/types.ts`) with two implementations: `supabase.ts` (production) and `local.ts` (explicit demo mode only, never a production fallback). Screens use hooks in `api/hooks.ts`. |
| Backend | Supabase Postgres with RLS on every table. Anything that must not be forged (XP, counters, moderation status, roles) is written only by triggers or security-definer functions. Policy helpers live in the unexposed `private` schema. |
| Auth | Supabase Auth (email + password, magic link, password reset, optional Google). A trigger creates a `profiles` row for every new user. |
| Storage | `gem-photos` bucket: public read, 5 MB, JPEG/PNG/WebP, uploads only into `<user id>/`. Photos are re-encoded in the browser, which strips EXIF/GPS. |
| Tests | Vitest (UI rules, demo backend, i18n), a throwaway Postgres 16 harness for migrations + RLS (`npm run test:db`), and CI on every PR. |

## 2. Existing tables and pieces to reuse

| Need | Reuse | Change |
| --- | --- | --- |
| Profiles, usernames, display names, bios | `profiles` (`handle` is already unique and validated, plus `name`, `bio`, `home`, `visibility`, `hue`, `xp`) | Add `avatar_url`. Split public and private columns (below). |
| Follow / unfollow | `follows` table, policies, XP hook | Tighten who can read follow edges. Add a stats function for counts. |
| Blocking | `blocks` + `private.is_blocked` | Also hide blocked people's posts and comments. |
| Reporting | `reports` table, rate limit, 3-report auto-hide | Accept `community`, `post`, `comment` targets. |
| Moderation | `moderate()`, `moderation_actions`, moderator queue sheet | Handle the new targets and let **community** moderators act inside their own community. |
| Content screening | `needs_review()` (links, phone numbers, emails, blocked terms), `enforce_rate_limit()` | Applied to communities, posts and comments. |
| XP / Passport | `xp_events` ledger, `award_xp()` with daily caps | New reasons for posting, comments, likes received, joining and creating communities. New "Community voice" badge. |
| Hidden-gem moderation | `gems` + moderator queue | Add `gems.source_post_id`. A gem submitted from a community recommendation is **always** held for review. |
| Photo upload | `preparePhoto()` (resize + EXIF strip), storage pattern | New `avatars` and `community-media` buckets with the same owner-folder rules. |
| Saves | `saves` holds places, gems and events and feeds trip planning | Saved posts go in a separate `post_saves` table so posts don't leak into trip planning. The Saved tab shows them in their own section. |

## 3. Database changes

Migration `20261111000007_community.sql` (additive, safe to apply before the new app is deployed):

- `communities`: slug, name, description, category (`place` / `interest` / `people`), optional destination and country, travel styles, colour, `official`, status, member and post counters.
- `community_members`: (community, user) primary key, role `member` / `moderator` / `owner`. Joining always creates a `member`. The creator becomes `owner` through a trigger. Roles change only through `set_member_role()`, which only owners can call.
- `community_posts`: kind (`discussion`, `question`, `recommendation`, `experience`), title, body, optional destination and place name, status, like, comment, save and report counters, `edited_at`.
- `post_media`: up to 6 photos per post. URLs must point into the author's own folder in `community-media`.
- `post_comments`, `post_likes`, `post_saves`.
- `profiles.avatar_url`. It must point into the owner's folder in `avatars`.
- `gems.source_post_id`.
- `get_my_profile()`: returns the caller's full row, including private columns.
- `profile_stats()`: follower, following, gem, post and community counts. Returns nothing for profiles the caller can't see.
- `set_member_role()`, `remove_member()`.
- `moderate()` is extended to the new targets.
- Starter "official" communities are added in `seed.sql`. They are empty: no fake members, posts or activity.

Migration `20261111000008_profile_privacy.sql` is applied **after** the new app is live, because older clients read `profiles.*`:

- The API can read only the public profile columns (`id, handle, name, home, bio, hue, avatar_url, styles, visited, socials, visibility, role, xp, created_at`).
- `preferences`, `watching` and `onboarded` are readable only by their owner, through `get_my_profile()`.

## 4. Security

- RLS on every new table before the app uses it. All writes go through policies plus `before` triggers that overwrite `author_id` / `user_id` with `auth.uid()`, so nobody can impersonate another account.
- Counters, statuses, roles and XP are never writable by clients: column-level grants plus definer triggers.
- Membership: people can only add themselves, always as `member`. Owners can't leave without deleting the community, so a community is never left ownerless. Community moderators can remove members, not owners.
- Moderation: global moderators can act on everything. Community owners and moderators can hide or restore posts and comments only in their own community.
- Content from blocked people is hidden. Private profiles are invisible to others, along with their follow edges, memberships and stats.
- Storage: public-read buckets, writes only into `<auth.uid()>/`, size and MIME limits enforced by the bucket. Database rows reject URLs outside the author's folder.
- Rate limits per day: 3 new communities, 20 posts, 100 comments, 500 likes, 50 joins.
- No service-role key in the app. Email addresses never appear in any public table.

## 5. Files

- **New:** `supabase/migrations/…007_community.sql`, `…008_profile_privacy.sql`, `supabase/tests/test_03_community.sql`, `src/data/communities.ts`, `src/screens/Community.tsx`, `src/screens/sheets/Community.tsx`, `src/components/CommunityCards.tsx`.
- **Changed:**
  - Data layer: `src/types.ts`, `src/api/{types,supabase,local,hooks}.ts`
  - Shell and navigation: `src/store/ui.ts`, `src/components/{Chrome,ui}.tsx`, `src/App.tsx`, `src/screens/Overlays.tsx`
  - Screens and sheets: `Saved.tsx`, `Passport.tsx`, `sheets/{Detail,Forms,Account}.tsx`
  - Rules and progress: `src/lib/{rules,progress}.ts`
  - Translations: `src/i18n/locales/*`
  - Seed: `scripts/gen-seed.ts`, `supabase/seed.sql`
  - Docs: README, SETUP

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hiding private profile columns breaks clients that select `profiles.*` | The new client never selects `*`. The column revoke is a separate migration, applied after deploy. |
| Five tabs on narrow phones | Tighter labels; checked at 360 px and in all six languages. |
| Gem auto-publishing | Unchanged for direct shares. Recommendations coming from Community are always held for moderator review. |
| Public buckets: files stay reachable if a post is hidden | Same model as gem photos today. The client deletes files when a post is deleted. A cleanup job is a follow-up. |
| Counter drift | Counters are maintained only by triggers. Tests cover insert, delete and status changes. |

## Postponed (not in this MVP)

Direct messages (later: mutual followers only), real-time chat, live location, meetups, video, paid or private communities, algorithmic recommendations (recommendations are rule-based: your styles, places you've saved or watch, and countries you've visited), community bans, and cover-photo uploads (covers use the illustrated scenes).
