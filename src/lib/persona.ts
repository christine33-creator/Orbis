import type { Destination, Profile, TravelStyle } from "../types";
import { DESTINATIONS } from "../data/destinations";

const ARCHETYPES: { styles: TravelStyle[]; title: string; blurb: string }[] = [
  { styles: ["culture", "photography"], title: "The Heritage Lens", blurb: "You chase golden hour at ancient places and come home with the story behind every frame." },
  { styles: ["adventure", "eco"], title: "The Trail Seeker", blurb: "Your best days start at a trailhead and end somewhere without phone signal." },
  { styles: ["food", "nightlife"], title: "The Night Market Gourmand", blurb: "You plan trips around dinner reservations and the bar the bartender recommends." },
  { styles: ["tech", "events"], title: "The Global Connector", blurb: "Summits, side-events and coworking terraces — you build a network in every city." },
  { styles: ["fashion", "culture"], title: "The Design Flâneur", blurb: "Runways, galleries and vintage stores: you travel to see what the world is making." },
  { styles: ["sports", "events"], title: "The Stadium Pilgrim", blurb: "Marathons, derbies and Grand Slams — you follow the roar of the crowd." },
  { styles: ["vacation", "wellness"], title: "The Slow Traveller", blurb: "Long breakfasts, hot springs and nowhere to be. Rest is the itinerary." },
  { styles: ["adventure", "photography"], title: "The Wild Frame", blurb: "Glaciers, fjords and sea cliffs: you'll hike two hours for the shot." },
  { styles: ["food", "culture"], title: "The Local Palate", blurb: "Markets, family kitchens and recipes you bring home." },
];

export function persona(p: Pick<Profile, "styles">) {
  let best = ARCHETYPES[0];
  let bestScore = -1;
  for (const a of ARCHETYPES) {
    const score = a.styles.filter((s) => p.styles.includes(s)).length;
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

/** Destinations ranked by fit with the profile; hidden gems get a boost for low popularity. */
export function recommend(p: Pick<Profile, "styles" | "visited">, opts: { gemsOnly?: boolean } = {}): (Destination & { fit: number })[] {
  return DESTINATIONS.filter((d) => !opts.gemsOnly || d.hiddenGem)
    .map((d) => {
      const overlap = d.styles.filter((s) => p.styles.includes(s)).length / Math.max(1, Math.min(3, d.styles.length));
      const novelty = p.visited.includes(d.country) ? 0.75 : 1;
      const quiet = (100 - d.popularity) / 100;
      const fit = Math.round(Math.min(99, (60 + overlap * 30 + quiet * 9) * novelty));
      return { ...d, fit };
    })
    .sort((a, b) => b.fit - a.fit);
}
