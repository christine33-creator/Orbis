import type { Destination, ItineraryDay, Stop, Trip, TripStyle } from "../types";
import { uid } from "../lib/util";

type Slot = 0 | 1 | 2 | 3; // morning, midday, afternoon, evening

interface Activity extends Omit<Stop, "id" | "time"> {
  slot: Slot;
  styles: TripStyle[];
}

const SLOT_TIMES = ["07:30", "11:30", "14:00", "18:30"];

const POOLS: Record<string, Activity[]> = {
  kyoto: [
    { slot: 0, styles: ["culture", "custom", "vacation"], label: "Golden hour", title: "Arashiyama Bamboo Grove", description: "Quiet early bird window before morning tour coaches.", tag: "Photography", secret: "Take the northern path heading towards Saga-Toriimoto preservation street for completely solitary photography." },
    { slot: 1, styles: ["culture", "custom"], title: "Matcha Ceremony at Otagi Nenbutsu-ji", description: "Surrounded by 1,200 unique moss-covered stone rakan sculptures, each carved with distinctive expressions.", tag: "Tea", transit: "18 min scenic path uphill from Saga station" },
    { slot: 2, styles: ["culture", "vacation", "custom"], title: "Handmade Soba Tasting at Yoshimura", description: "Panoramic bay window overlooking Togetsukyo Bridge and Oi River.", tag: "Food", reserved: "Table for 2 · Riverfront seat" },
    { slot: 3, styles: ["culture", "vacation", "events", "custom"], label: "Dusk lanterns", title: "Gion Evening Lantern Stroll", description: "Cobblestone exploration through historic wooden machiya teahouses and Shirakawa canal.", tag: "Culture & History", transit: "Self-guided audio walkthrough available (18 mins)" },
    { slot: 0, styles: ["culture", "adventure", "custom"], label: "Sunrise", title: "Fushimi Inari Summit Hike", description: "10,000 vermilion torii gates up Mount Inari — empty before 7 AM.", tag: "Hike", secret: "Turn right at the Yotsutsuji intersection for a city panorama most visitors miss." },
    { slot: 1, styles: ["culture", "vacation"], title: "Nishiki Market Grazing", description: "Five blocks of pickles, tamagoyaki and fresh yuba.", tag: "Food" },
    { slot: 2, styles: ["culture", "custom"], title: "Philosopher's Path to Ginkaku-ji", description: "Canal-side walk lined with maple, ending at the Silver Pavilion's sand garden.", tag: "Walk" },
    { slot: 3, styles: ["events", "vacation"], title: "Eikandō Maple Illumination", description: "Night light-up of 3,000 maples reflected in Hojo pond.", tag: "Event", reserved: "Timed entry 18:30" },
    { slot: 0, styles: ["adventure", "sports"], title: "Kurama to Kibune Mountain Trail", description: "Cedar-forest ridge hike linking two mountain shrines.", tag: "Hike", transit: "Eizan Railway from Demachiyanagi, 30 min" },
    { slot: 2, styles: ["adventure", "sports", "vacation"], title: "Hozugawa River Boat Ride", description: "Two hours of gentle rapids through a forested gorge.", tag: "Outdoors" },
    { slot: 3, styles: ["sports", "events", "adventure"], title: "Kyoto Sanga Match Night", description: "J-League football at Sanga Stadium with local fan chants.", tag: "Sports" },
    { slot: 1, styles: ["vacation", "custom"], title: "Kurama Onsen Soak", description: "Open-air hot spring under maples after the morning hike.", tag: "Wellness" },
  ],
  lisbon: [
    { slot: 0, styles: ["sports", "adventure", "vacation"], label: "Dawn session", title: "Surf at Carcavelos", description: "Consistent beach break 25 min by train from Cais do Sodré.", tag: "Surf", secret: "The north end near the fort has softer waves for beginners." },
    { slot: 1, styles: ["culture", "vacation", "custom"], title: "Pastéis at Manteigaria", description: "Warm custard tarts straight from the oven — watch the bakers through the glass.", tag: "Food" },
    { slot: 2, styles: ["events", "custom"], title: "Web Summit Side Event: Alfama Terrace", description: "Founders, coffee and a view over the Tagus.", tag: "Tech" },
    { slot: 3, styles: ["culture", "vacation", "events"], label: "Sunset", title: "Miradouro da Senhora do Monte", description: "Lisbon's highest viewpoint — bring a bottle of vinho verde.", tag: "Viewpoint" },
    { slot: 3, styles: ["culture", "events"], title: "Fado in Mouraria", description: "Intimate tasca fado where the singers are locals.", tag: "Music", reserved: "Dinner + fado 20:30" },
    { slot: 1, styles: ["culture", "custom"], title: "LX Factory Wander", description: "Bookshops in old printing presses and street art.", tag: "Design" },
    { slot: 2, styles: ["adventure", "vacation"], title: "Sintra Palaces Day Trip", description: "Pena Palace and the Initiation Well at Quinta da Regaleira.", tag: "Day trip" },
    { slot: 3, styles: ["sports", "events"], title: "Benfica at Estádio da Luz", description: "Watch the eagle fly before kickoff.", tag: "Sports" },
  ],
};

const GENERIC: Record<TripStyle, ((d: Destination) => Omit<Activity, "styles">)[]> = {
  vacation: [
    (d) => ({ slot: 0, title: `Slow breakfast in ${d.name}`, description: "Start the day at a local café — no alarm required.", tag: "Food" }),
    (d) => ({ slot: 1, title: `${d.name} highlights walk`, description: d.tagline, tag: "Explore" }),
    () => ({ slot: 2, title: "Pool, beach or spa time", description: "Recharge in the heat of the day.", tag: "Wellness" }),
    (d) => ({ slot: 3, label: "Sunset", title: `Sunset dinner in ${d.name}`, description: "Ask locals for the spot with the view.", tag: "Food" }),
  ],
  culture: [
    (d) => ({ slot: 0, label: "Golden hour", title: `Old town of ${d.name} at first light`, description: "Beat the crowds to the landmarks.", tag: "Photography", secret: d.tip.text }),
    (d) => ({ slot: 1, title: `${d.region} history museum`, description: "Get the story before you see the streets.", tag: "Museum" }),
    () => ({ slot: 2, title: "Local market & food tasting", description: "Graze through the stalls and talk to vendors.", tag: "Food" }),
    () => ({ slot: 3, title: "Traditional music or performance", description: "Check the field notes for tonight's best venue.", tag: "Culture & History" }),
  ],
  adventure: [
    (d) => ({ slot: 0, label: "Alpine start", title: `Summit hike near ${d.name}`, description: d.description, tag: "Hike", secret: d.tip.text }),
    () => ({ slot: 1, title: "Trailside picnic", description: "Pack lunch from a village bakery.", tag: "Outdoors" }),
    () => ({ slot: 2, title: "Wild swim or kayak", description: "Cool off in a lake, river or cove.", tag: "Water" }),
    () => ({ slot: 3, title: "Guesthouse dinner", description: "Swap route intel with other hikers.", tag: "Food" }),
  ],
  sports: [
    () => ({ slot: 0, title: "Group run with locals", description: "Join a community run club meetup.", tag: "Run" }),
    (d) => ({ slot: 1, title: `Stadium tour in ${d.name}`, description: "Behind the scenes of the home club.", tag: "Sports" }),
    () => ({ slot: 2, title: "Fan zone & pre-game", description: "Where the supporters gather before kickoff.", tag: "Sports" }),
    () => ({ slot: 3, title: "Match night", description: "Grab tickets in the home end for the full atmosphere.", tag: "Sports", reserved: "Tickets in wallet" }),
  ],
  events: [
    () => ({ slot: 0, title: "Coffee with fellow attendees", description: "Check Groups for meetups tied to this event.", tag: "Social" }),
    (d) => ({ slot: 1, title: `Main event in ${d.name}`, description: "Doors open — badges and passes ready.", tag: "Event", reserved: "Pass confirmed" }),
    () => ({ slot: 2, title: "Side events & pop-ups", description: "The unofficial programme is often the best.", tag: "Social" }),
    () => ({ slot: 3, title: "After-party", description: "See the Pulse feed for tonight's spots.", tag: "Nightlife" }),
  ],
  custom: [
    (d) => ({ slot: 1, title: `Explore ${d.name}`, description: "A blank canvas — add stops that match your plans.", tag: "Explore" }),
  ],
};

const DAY_TITLES: Record<TripStyle, string[]> = {
  vacation: ["Arrival & Unwind", "Slow Days", "Hidden Corners", "Sun & Sea", "Last Lazy Morning"],
  culture: ["Ancient Temples & Bamboo Secrets", "Markets & Makers", "Old Quarter Stories", "Sacred Hills", "Farewell Feast"],
  adventure: ["Trailhead Day", "Ridge & Rivers", "Summit Push", "Lakes & Valleys", "Descent & Celebration"],
  sports: ["Arrival & Fan Zone", "Match Day", "Recovery & Run", "Derby Day", "Final Whistle"],
  events: ["Arrival & Badge Pickup", "Main Stage", "Side Events", "Networking Day", "Wrap Party"],
  custom: ["Day plan", "Day plan", "Day plan", "Day plan", "Day plan"],
};

function toStop(a: Omit<Activity, "styles">): Stop {
  const { slot, ...rest } = a;
  return { ...rest, id: uid(), time: SLOT_TIMES[slot] };
}

/** Builds a day-by-day itinerary for a destination tailored to the trip style. */
export function generateItinerary(d: Destination, style: TripStyle, dayCount: number): ItineraryDay[] {
  const pool = (POOLS[d.id] ?? []).filter((a) => a.styles.includes(style) || style === "custom");
  const generic = GENERIC[style].map((f) => f(d));
  const days: ItineraryDay[] = [];
  const used = new Set<number>();
  for (let i = 0; i < dayCount; i++) {
    const stops: Stop[] = [];
    const slots: Slot[] = style === "custom" ? [1] : [0, 1, 2, 3];
    for (const slot of slots) {
      const idx = pool.findIndex((a, k) => a.slot === slot && !used.has(k));
      if (idx >= 0) {
        used.add(idx);
        const { styles: _s, ...a } = pool[idx];
        stops.push(toStop(a));
      } else {
        const g = generic.find((x) => x.slot === slot);
        if (g) stops.push(toStop(g));
      }
    }
    days.push({ title: DAY_TITLES[style][i % DAY_TITLES[style].length], stops });
  }
  return days;
}

export function buildTrip(d: Destination, style: TripStyle, startDate: string, dayCount: number, title?: string): Trip {
  return {
    id: uid(),
    destinationId: d.id,
    style,
    startDate,
    title: title || `${d.name} ${STYLE_TITLE[style]}`,
    days: generateItinerary(d, style, dayCount),
  };
}

const STYLE_TITLE: Record<TripStyle, string> = {
  vacation: "Getaway",
  culture: "Culture Odyssey",
  adventure: "Expedition",
  sports: "Sports Trip",
  events: "Event Weekend",
  custom: "Journey",
};
