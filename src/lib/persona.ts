import type { Profile, TravelStyle } from "../types";

/** Ids map to `persona.<id>.title|blurb` in the locale files. */
export type PersonaId = "heritageLens" | "trailSeeker" | "nightMarket" | "connector" | "flaneur" | "stadium" | "slow" | "wildFrame" | "localPalate";

const ARCHETYPES: { id: PersonaId; styles: TravelStyle[] }[] = [
  { id: "heritageLens", styles: ["culture", "photography"] },
  { id: "trailSeeker", styles: ["adventure", "eco"] },
  { id: "nightMarket", styles: ["food", "nightlife"] },
  { id: "connector", styles: ["tech", "events"] },
  { id: "flaneur", styles: ["fashion", "culture"] },
  { id: "stadium", styles: ["sports", "events"] },
  { id: "slow", styles: ["vacation", "wellness"] },
  { id: "wildFrame", styles: ["adventure", "photography"] },
  { id: "localPalate", styles: ["food", "culture"] },
];

export function persona(p: Pick<Profile, "styles">): PersonaId {
  let best = ARCHETYPES[0];
  let bestScore = -1;
  for (const a of ARCHETYPES) {
    const score = a.styles.filter((s) => p.styles.includes(s)).length;
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best.id;
}
