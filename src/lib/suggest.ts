import type { Destination, Gem, ItemType, Profile, PulseEvent, Save, TravelStyle } from "../types";

/**
 * Rules-based suggestions. Every suggestion carries the human-readable reasons that produced
 * it, so the UI can say why something was recommended. Pure functions; unit tested.
 */

export interface Suggestion {
  itemType: ItemType;
  id: string;
  score: number;
  reasons: string[];
}

export interface SuggestInput {
  profile: Pick<Profile, "styles" | "visited" | "watching"> | null;
  saves: Save[];
  destinations: Destination[];
  gems: Gem[];
  events: PulseEvent[];
  now?: Date;
}

const STYLE_WORDS: Record<TravelStyle, string> = {
  culture: "culture", photography: "photography", vacation: "slow travel", adventure: "adventure", sports: "sports",
  events: "events", food: "food", nightlife: "nightlife", eco: "nature", tech: "tech", fashion: "design", wellness: "wellness",
};

/** Event categories that line up with each travel style. */
const EVENT_STYLE: Record<string, TravelStyle[]> = {
  sports: ["sports", "adventure"], tech: ["tech"], fashion: ["fashion"], art: ["culture", "photography", "fashion"],
  music: ["nightlife", "events"], food: ["food"], festival: ["events", "culture"], other: [],
};

function overlap(a: TravelStyle[], b: TravelStyle[]) {
  return a.filter((s) => b.includes(s));
}

/** Destinations and countries the person has shown interest in through saves. */
function interestSignals(input: SuggestInput) {
  const savedDest = new Set<string>();
  const savedCountries = new Set<string>();
  const savedStyles = new Map<TravelStyle, number>();
  const bump = (styles: TravelStyle[]) => styles.forEach((s) => savedStyles.set(s, (savedStyles.get(s) ?? 0) + 1));
  for (const s of input.saves) {
    if (s.itemType === "destination") {
      const d = input.destinations.find((x) => x.id === s.itemId);
      if (d) {
        savedDest.add(d.id);
        savedCountries.add(d.country);
        bump(d.styles);
      }
    } else if (s.itemType === "gem") {
      const g = input.gems.find((x) => x.id === s.itemId);
      if (g) {
        if (g.destinationId) savedDest.add(g.destinationId);
        savedCountries.add(g.country);
        bump(g.styles);
      }
    } else {
      const e = input.events.find((x) => x.id === s.itemId);
      if (e?.destinationId) savedDest.add(e.destinationId);
    }
  }
  return { savedDest, savedCountries, savedStyles };
}

export function suggest(input: SuggestInput, limit = 12): Suggestion[] {
  const styles = input.profile?.styles ?? [];
  const watching = new Set(input.profile?.watching ?? []);
  const visited = new Set(input.profile?.visited ?? []);
  const saved = new Set(input.saves.map((s) => `${s.itemType}:${s.itemId}`));
  const { savedDest, savedCountries, savedStyles } = interestSignals(input);
  const topSavedStyle = [...savedStyles.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const now = (input.now ?? new Date()).getTime();
  const destName = (id: string | null) => input.destinations.find((d) => d.id === id)?.name;
  const out: Suggestion[] = [];

  for (const d of input.destinations) {
    if (saved.has(`destination:${d.id}`)) continue;
    const reasons: string[] = [];
    let score = 0;
    const match = overlap(d.styles, styles);
    if (match.length) {
      score += 12 * match.length;
      reasons.push(`Matches your love of ${match.slice(0, 2).map((s) => STYLE_WORDS[s]).join(" & ")}`);
    }
    if (watching.has(d.id)) {
      score += 25;
      reasons.push("On your radar");
    }
    if (savedCountries.has(d.country) && !savedDest.has(d.id)) {
      score += 10;
      reasons.push(`You saved places in ${d.country}`);
    }
    if (topSavedStyle && d.styles.includes(topSavedStyle)) score += 6;
    if (d.hiddenGem) {
      score += 8;
      reasons.push("Few crowds");
    }
    if (visited.has(d.country)) score -= 10;
    const soon = input.events.filter((e) => e.destinationId === d.id && new Date(e.startsAt).getTime() - now < 30 * 86400000);
    if (soon.length) {
      score += 8;
      reasons.push(`${soon[0].title} coming up`);
    }
    if (score > 0) out.push({ itemType: "destination", id: d.id, score, reasons });
  }

  for (const g of input.gems) {
    if (g.status !== "published" || saved.has(`gem:${g.id}`)) continue;
    const reasons: string[] = [];
    let score = 0;
    const match = overlap(g.styles, styles);
    if (match.length) {
      score += 10 * match.length;
      reasons.push(`Great for ${match.slice(0, 2).map((s) => STYLE_WORDS[s]).join(" & ")}`);
    }
    if (g.destinationId && (savedDest.has(g.destinationId) || watching.has(g.destinationId))) {
      score += 22;
      reasons.push(`Near ${destName(g.destinationId)}, which you're interested in`);
    }
    score += Math.min(10, Math.log2(1 + g.upvotes) * 1.5);
    if (g.upvotes >= 50) reasons.push(`${g.upvotes} explorers upvoted this`);
    if (score > 0) out.push({ itemType: "gem", id: g.id, score, reasons });
  }

  for (const e of input.events) {
    if (saved.has(`event:${e.id}`)) continue;
    const reasons: string[] = [];
    let score = 0;
    const match = overlap(EVENT_STYLE[e.category] ?? [], styles);
    if (match.length) {
      score += 10;
      reasons.push(`For ${STYLE_WORDS[match[0]]} fans`);
    }
    if (e.destinationId && (savedDest.has(e.destinationId) || watching.has(e.destinationId))) {
      score += 20;
      reasons.push(`In ${e.city}, which you're interested in`);
    }
    const days = (new Date(e.startsAt).getTime() - now) / 86400000;
    if (days >= 0 && days <= 14) {
      score += 5;
      reasons.push("Happening soon");
    }
    if (score > 0) out.push({ itemType: "event", id: e.id, score, reasons });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Saved gems and events at a destination, ready to drop into that trip. */
export function savedForDestination(destinationId: string, input: Pick<SuggestInput, "saves" | "gems" | "events">) {
  return input.saves.filter((s) => {
    if (s.itemType === "gem") return input.gems.find((g) => g.id === s.itemId)?.destinationId === destinationId;
    if (s.itemType === "event") return input.events.find((e) => e.id === s.itemId)?.destinationId === destinationId;
    return false;
  });
}
