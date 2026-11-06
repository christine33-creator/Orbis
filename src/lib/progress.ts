/** Points & levels: every community contribution earns XP. */

export const XP = {
  completeProfile: 100,
  addVisitedCountry: 15,
  shareGem: 50,
  submitTip: 40,
  upvote: 2,
  saveGem: 5,
  createTrip: 60,
  completeStop: 15,
  joinGroup: 30,
  createGroup: 50,
  follow: 5,
  connect: 10,
  connectSocial: 20,
  watchDestination: 10,
} as const;

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
  const tier = [...TIERS].reverse().find((t) => level >= t.min)!.name;
  const nextTier = TIERS.find((t) => t.min > level)?.name;
  return {
    level,
    tier,
    nextTier,
    floor,
    next,
    pct: level >= max ? 100 : Math.round(((xp - floor) / (next - floor)) * 100),
  };
}

export const tierFor = (level: number) => [...TIERS].reverse().find((t) => level >= t.min)!.name;

export interface Badge {
  id: string;
  title: string;
  desc: string;
  icon: "lightbulb" | "gem" | "users" | "globe" | "route" | "heart";
  progress: (s: BadgeInput) => [number, number];
}

export interface BadgeInput {
  tips: number;
  gemsShared: number;
  groupsJoined: number;
  countries: number;
  tripsPlanned: number;
  following: number;
}

export const BADGES: Badge[] = [
  { id: "tips", title: "Secret Tip Contributor", desc: "verified tips unlocked", icon: "lightbulb", progress: (s) => [s.tips, 5] },
  { id: "gems", title: "Gem Finder", desc: "hidden destinations scouted", icon: "gem", progress: (s) => [s.gemsShared, 3] },
  { id: "host", title: "Community Host", desc: "group expeditions joined", icon: "users", progress: (s) => [s.groupsJoined, 2] },
  { id: "globe", title: "Globetrotter", desc: "countries stamped", icon: "globe", progress: (s) => [s.countries, 10] },
  { id: "planner", title: "Itinerary Architect", desc: "trips planned", icon: "route", progress: (s) => [s.tripsPlanned, 3] },
  { id: "social", title: "Connector", desc: "travellers followed", icon: "heart", progress: (s) => [s.following, 5] },
];
