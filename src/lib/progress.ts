/** Levels, tiers and badges. XP itself is granted by the backend (see lib/rules.ts). */

/** Cumulative XP required to reach each level (index = level). */
const THRESHOLDS = [0, 0, 150, 400, 750, 1200, 1800, 2600, 3500, 4600, 6000, 8000];

const TIERS = [
  { min: 1, name: "Wanderer" },
  { min: 3, name: "Explorer" },
  { min: 5, name: "Trailblazer" },
  { min: 7, name: "Pathfinder" },
  { min: 9, name: "Navigator" },
  { min: 11, name: "Summit Master" },
];

export function levelFor(xp: number) {
  let level = 1;
  for (let l = 1; l < THRESHOLDS.length; l++) if (xp >= THRESHOLDS[l]) level = l;
  const max = THRESHOLDS.length - 1;
  const floor = THRESHOLDS[level];
  const next = level < max ? THRESHOLDS[level + 1] : floor;
  return {
    level,
    tier: tierFor(level),
    nextTier: TIERS.find((t) => t.min > level)?.name,
    floor,
    next,
    pct: level >= max ? 100 : Math.round(((xp - floor) / (next - floor)) * 100),
  };
}

export const tierFor = (level: number) => [...TIERS].reverse().find((t) => level >= t.min)!.name;

export interface BadgeInput {
  gemsShared: number;
  saves: number;
  countries: number;
  tripsPlanned: number;
  following: number;
}

export const BADGES: { id: string; title: string; desc: string; icon: "gem" | "bookmark" | "globe" | "route" | "heart"; progress: (s: BadgeInput) => [number, number] }[] = [
  { id: "gems", title: "Gem Finder", desc: "hidden gems shared", icon: "gem", progress: (s) => [s.gemsShared, 3] },
  { id: "collector", title: "Collector", desc: "places saved", icon: "bookmark", progress: (s) => [s.saves, 10] },
  { id: "planner", title: "Itinerary Architect", desc: "trips planned", icon: "route", progress: (s) => [s.tripsPlanned, 3] },
  { id: "globe", title: "Globetrotter", desc: "countries stamped", icon: "globe", progress: (s) => [s.countries, 10] },
  { id: "social", title: "Connector", desc: "explorers followed", icon: "heart", progress: (s) => [s.following, 5] },
];
