# Solis

A community app for travel enthusiasts: a world map of destinations, hidden gems, worldwide social happenings, style-based itineraries, travel-buddy matching, and points & levels that reward people for contributing.

> Mobile-first web app (React + TypeScript + Vite + Tailwind). All data is local mock data behind a small store, so it runs with no backend.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
SINGLE_FILE=1 npm run build   # everything inlined into one dist/index.html
```

## What's in it

| Area | Where | What it does |
| --- | --- | --- |
| **Onboarding** | `src/screens/Onboarding.tsx` | 6 steps: profile, travel styles & preferences, countries visited (live map), destinations on your radar, optional first trip, social handles. Ends with a generated **travel persona** and hidden gems picked for you. There's a "demo profile" shortcut too. |
| **Explore** | `src/screens/Explore.tsx` | Search, category filters (Hidden Gems, Sports, Tech, Fashion, Art, Music, Food), Gems Radar top match, curated hidden-gem carousel (save/upvote), world map preview, **Global Pulse** social feed, explorers to follow, "Share a Gem". |
| **World map** | `src/components/WorldMap.tsx` | Offline SVG world map (d3-geo + world-atlas). Pan/zoom, search, layers (all / gems / live events / my radar). Visited countries are shaded. |
| **Groups** | `src/screens/Groups.tsx` | Buddy-match beacon for your active trip, companion matches ranked by **sync rate** (shared styles + overlapping dates, in `src/lib/match.ts`), connect / join requests, group expeditions, create your own group. |
| **Itinerary** | `src/screens/Itinerary.tsx` | Trips generated per style (vacation, culture, adventure, sports, events, custom) in `src/data/activities.ts`. Day-by-day timeline, explorer secrets, reservations, check-ins, add/remove stops, re-plan a day, share, destination news radar, voted field notes. |
| **Passport** | `src/screens/Passport.tsx` | Level/tier and XP, badges, passport stamps, your map, travel DNA, connected social accounts, following, and privacy (visibility, companion matching, live beacon). |
| **Points** | `src/lib/progress.ts` | XP per action (share gem +50, field note +40, plan trip +60, join group +30…), 11 levels across 6 tiers (Wanderer → Summit Master), badge goals. |
| **News** | bell icon → `NewsSheet` | Alerts, verified local intel and events for destinations on your radar. |

State lives in `src/store/useApp.ts` (zustand, persisted to `localStorage`). Seed content is in `src/data/`.

## Next steps toward production

- **Backend + auth:** replace `src/data/*` and the store's actions with API calls (Supabase/Firebase are quick fits). Real follows, chat, group membership and ID verification all need a server.
- **Real news/events:** feed `NEWS`/`PULSE` from an events API or editorial CMS, keyed by destination.
- **Imagery:** destination art is procedural SVG (`src/components/Scene.tsx`); swap for licensed photos or user uploads.
- **Native app:** the components map cleanly onto React Native / Expo if you want App Store builds.
- **Name:** the app name is one constant, `APP_NAME` in `src/lib/util.ts` (alternatives considered: Orbis, Solara, Novara).
