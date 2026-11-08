# Orbis

*See beyond the destination.*

Orbis is a social travel discovery platform that helps curious explorers discover destinations, experiences and global happenings, save what inspires them, and turn those discoveries into personalized travel plans.

The MVP is built around one loop: **discover → save → plan**.

## Run it

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` without configuration runs in **demo mode**: a full working backend in your browser, with data stored on that device. Production builds never do this: without Supabase settings they show a "not connected" screen. For a shareable demo build, set `VITE_DEMO_MODE=1`. To go live, follow **[SETUP.md](SETUP.md)**.

## What's in the MVP

| Priority | Feature | Where |
| --- | --- | --- |
| P0 | Map + discovery feed | `screens/Explore.tsx`, `screens/ExploreMap.tsx`, `components/MapView.tsx` (MapLibre + OpenFreeMap, offline fallback) |
| P0 | Destinations & destination pages | `screens/sheets/Detail.tsx` |
| P0 | Hidden Gems: submit with photos and map pin, upvote, save, credited to the finder | `screens/sheets/Forms.tsx` (`ShareGemSheet`), `components/Cards.tsx` |
| P0 | Profiles & preferences | `screens/Onboarding.tsx`, edit profile, privacy settings |
| P0 | Save destinations, gems and happenings | Saved tab, grouped by destination (`screens/Saved.tsx`) |
| P0 | Itinerary builder | Trips tab (`screens/Trips.tsx`): build days from saves and suggestions, reorder, check in, share |
| P0 | Rules-based suggestions, with the reason shown | `lib/suggest.ts` |
| P0 | Moderation & safety | Report, block, auto-hold for links and contact details, auto-hide after 3 reports, moderation queue, rate limits, account deletion, photo location stripping |
| P1 | Passport & XP | `screens/Passport.tsx`; XP is granted by the database so it can't be faked |
| P1 | Global Pulse automation | `supabase/functions/sync-events` (Ticketmaster) |
| P1 | Following | Profile pages |
| P2 | Direct messaging, Buddy Beacon & groups | Not in this release. An earlier prototype of groups and buddy matching is in git history (commit `f09c0a5`) |

## How it's built

- **App:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, MapLibre GL.
- **Backend:** Supabase (Postgres with row-level security, Auth, Storage, Edge Functions). See `supabase/migrations`.
- **One API, two backends:** `src/api/types.ts` defines everything the UI needs. `src/api/supabase.ts` is the real implementation; `src/api/local.ts` is the demo backend with the same rules. `src/api/index.ts` picks one based on environment variables.
- **Rules live in the database.** XP, counters, content status, rate limits and moderation are enforced by triggers and policies, so a modified client can't bypass them.

## Languages

The interface is available in English, Spanish, French, Portuguese, German and Japanese. The app picks the device's language, people can change it in **Settings** (or the first onboarding step), and the choice is saved to their profile.

- Strings live in `src/i18n/locales/<code>.ts`. English (`en.ts`) is the source of truth.
- TypeScript fails the build if a language is missing a key, and `npm test` checks that every key used in the code exists and that each translation keeps the same `{{placeholders}}`.
- To add a language: copy `es.ts` to a new file, translate it, and add it to `LANGUAGES` and `resources` in `src/i18n/index.ts`.
- Translations other than English were machine-assisted. Have a native speaker review them before marketing in that language.
- User content (gem descriptions, notes, bios) and curated destination text are shown as written; they are not translated.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app locally |
| `npm run build` | Type-check and build for production |
| `npm test` | Unit tests |
| `npm run test:db` | Apply migrations and seed to a throwaway Postgres 16 and run the security tests |
| `npm run seed:gen` | Regenerate `supabase/seed.sql` from `src/data/` |
