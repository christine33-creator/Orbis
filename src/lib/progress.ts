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
] as const;

export type Tier = (typeof TIERS)[number]["name"];

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

export const tierFor = (level: number): Tier => [...TIERS].reverse().find((t) => level >= t.min)!.name;

export interface BadgeInput {
  gemsShared: number;
  saves: number;
  countries: number;
  tripsPlanned: number;
  following: number;
  posts: number;
}

export const BADGES: { id: "gems" | "collector" | "planner" | "globe" | "social" | "voice"; icon: "gem" | "bookmark" | "globe" | "route" | "heart" | "message"; progress: (s: BadgeInput) => [number, number] }[] = [
  { id: "gems", icon: "gem", progress: (s) => [s.gemsShared, 3] },
  { id: "collector", icon: "bookmark", progress: (s) => [s.saves, 10] },
  { id: "planner", icon: "route", progress: (s) => [s.tripsPlanned, 3] },
  { id: "globe", icon: "globe", progress: (s) => [s.countries, 10] },
  { id: "social", icon: "heart", progress: (s) => [s.following, 5] },
  { id: "voice", icon: "message", progress: (s) => [s.posts, 3] },
];
