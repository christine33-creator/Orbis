import type { CommunityCategory, TravelStyle } from "../types";

/**
 * Official starter communities. They are created empty (no members, posts or activity) so
 * new explorers have somewhere to start. Used by scripts/gen-seed.ts and the demo backend.
 */
export interface CommunitySeed {
  slug: string;
  name: string;
  description: string;
  category: CommunityCategory;
  destinationId: string | null;
  country: string;
  styles: TravelStyle[];
  hue: number;
}

export const COMMUNITY_SEEDS: CommunitySeed[] = [
  { slug: "japan-travel-club", name: "Japan Travel Club", description: "Temples, trains, tiny bars and the quiet side of Japan. Ask before you go, share what you found.", category: "place", destinationId: "kyoto", country: "Japan", styles: ["culture", "food", "photography"], hue: 345 },
  { slug: "solo-explorers", name: "Solo Explorers", description: "For people who travel on their own: safety tips, where to meet others and places that are easy to do solo.", category: "people", destinationId: null, country: "", styles: ["adventure", "culture"], hue: 200 },
  { slug: "food-trails", name: "Food Trails", description: "Markets, street food and the meals worth crossing a city for.", category: "interest", destinationId: null, country: "", styles: ["food"], hue: 25 },
  { slug: "hidden-gem-hunters", name: "Hidden Gem Hunters", description: "Places beyond the usual lists. Share recommendations here and the best go to Explore after review.", category: "interest", destinationId: null, country: "", styles: ["culture", "eco"], hue: 160 },
  { slug: "trail-summit", name: "Trail & Summit", description: "Hikes, treks and mountain huts, from day walks to multi-day routes.", category: "interest", destinationId: "patagonia", country: "", styles: ["adventure", "eco", "sports"], hue: 130 },
  { slug: "festival-chasers", name: "Festival Chasers", description: "Plan around the world's festivals, matches and big nights out.", category: "interest", destinationId: null, country: "", styles: ["events", "nightlife"], hue: 280 },
  { slug: "slow-travel", name: "Slow Travel", description: "Longer stays, fewer places, more depth. Swap tips on living like a local.", category: "people", destinationId: null, country: "", styles: ["wellness", "culture"], hue: 50 },
  { slug: "iberia-wanderers", name: "Iberia Wanderers", description: "Portugal and Spain: tascas, tiles, coastlines and mountain villages.", category: "place", destinationId: "lisbon", country: "Portugal", styles: ["culture", "food", "vacation"], hue: 15 },
  { slug: "through-the-lens", name: "Through the Lens", description: "Travel photographers sharing spots, light and timing.", category: "interest", destinationId: null, country: "", styles: ["photography"], hue: 230 },
];
