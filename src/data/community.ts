import type { FieldNote, GroupExpedition, NewsItem, PulseEvent, Scene, Traveler } from "../types";

const s = (kind: Scene["kind"], ...palette: Scene["palette"]): Scene => ({ kind, palette });

export const TRAVELERS: Traveler[] = [
  {
    id: "elena", name: "Elena Vance", handle: "elena_wander", hue: 18, level: 6, home: "Austin, TX", verified: true,
    styles: ["photography", "culture", "food"], interests: ["Photography", "Historic shrines", "Ramen hunter"],
    bio: "Film photographer chasing early light and late ramen.", countries: 31, followers: 2840, following: 410, journeys: 14,
    socials: { instagram: "elena.frames", x: "elenavance" },
    plannedTrip: { destinationId: "kyoto", from: "2026-11-16", to: "2026-11-22", note: "Solo in Kyoto Nov 16–22. Looking for someone to rent bikes & explore Arashiyama bamboo path early morning before the tour crowds arrive!" },
  },
  {
    id: "devonliam", name: "Devon & Liam", handle: "two_nomads", hue: 200, level: 8, home: "London, UK", verified: true,
    styles: ["food", "nightlife", "culture"], interests: ["Night markets", "Mount Hiei hike", "Social breweries"],
    bio: "Two Londoners, one shared spreadsheet of every izakaya in Japan.", countries: 44, followers: 12100, following: 380, journeys: 27,
    socials: { instagram: "two.nomads", tiktok: "twonomads" }, partySize: 2,
    plannedTrip: { destinationId: "kyoto", from: "2026-11-15", to: "2026-11-21", note: "Organizing a group izakaya hop & day trip to Nara deer park on Nov 19. 2 spots left for easygoing explorers who love food!" },
  },
  {
    id: "chiyo", name: "Chiyo Tanaka", handle: "chiyo_explorer", hue: 340, level: 9, home: "Kyoto, Japan", verified: true,
    styles: ["culture", "wellness", "photography"], interests: ["Tea ceremony", "Moss gardens", "Local guide"],
    bio: "Kyoto local. I share the quiet side of my city.", countries: 12, followers: 8900, following: 120, journeys: 40,
    socials: { instagram: "chiyo.kyoto" },
  },
  {
    id: "kenji", name: "Kenji Mori", handle: "kenji_visuals", hue: 260, level: 7, home: "Tokyo, Japan", verified: true,
    styles: ["photography", "tech", "nightlife"], interests: ["Street photography", "Synth music", "Night walks"],
    bio: "Neon and long exposures.", countries: 19, followers: 21400, following: 610, journeys: 22,
    socials: { instagram: "kenji.visuals", x: "kenjimori" },
    plannedTrip: { destinationId: "tokyo", from: "2026-11-20", to: "2026-11-30", note: "Back home for Tokyo design week — happy to show photographers around Shimokita." },
  },
  {
    id: "mateo", name: "Mateo Ruiz", handle: "mateo.andes", hue: 120, level: 9, home: "Santiago, Chile", verified: true,
    styles: ["adventure", "eco", "sports"], interests: ["Trekking", "Climbing", "Wild camping"],
    bio: "Mountain guide. 40+ W-Treks led.", countries: 26, followers: 5400, following: 230, journeys: 51,
    socials: { strava: "mateoruiz", instagram: "mateo.andes" },
    plannedTrip: { destinationId: "patagonia", from: "2026-11-08", to: "2026-11-18", note: "Leading a small W-Trek crew in November. Fitness: moderate." },
  },
  {
    id: "alina", name: "Alina Petrova", handle: "alina_travels", hue: 160, level: 5, home: "Sofia, Bulgaria", verified: false,
    styles: ["eco", "vacation", "photography"], interests: ["Waterfalls", "Wild swimming", "Scooter trips"],
    bio: "Balkan backroads, one waterfall at a time.", countries: 22, followers: 1900, following: 300, journeys: 11,
    socials: { instagram: "alina.trvl" },
    plannedTrip: { destinationId: "kravice", from: "2027-05-20", to: "2027-05-27", note: "Balkan waterfall loop by scooter. Need one more rider!" },
  },
  {
    id: "marcos", name: "Marcos Silva", handle: "marcos_nomad", hue: 30, level: 6, home: "Lisbon, Portugal", verified: true,
    styles: ["tech", "nightlife", "sports"], interests: ["Startups", "Surfing", "Coworking"],
    bio: "Founder, surfer, Web Summit regular.", countries: 35, followers: 3300, following: 540, journeys: 18,
    socials: { x: "marcos_builds", instagram: "marcos.nomad" },
    plannedTrip: { destinationId: "lisbon", from: "2026-11-09", to: "2026-11-15", note: "Web Summit week — running a sunrise surf + coffee meetup." },
  },
  {
    id: "giulia", name: "Giulia Romano", handle: "giulia.style", hue: 300, level: 7, home: "Milan, Italy", verified: true,
    styles: ["fashion", "culture", "events"], interests: ["Runway", "Vintage", "Design"],
    bio: "Fashion editor. Ask me about Milan's secret sample sales.", countries: 29, followers: 18700, following: 800, journeys: 16,
    socials: { instagram: "giulia.style", tiktok: "giuliastyle" },
  },
  {
    id: "nino", name: "Nino Beridze", handle: "nino_trails", hue: 90, level: 4, home: "Tbilisi, Georgia", verified: false,
    styles: ["adventure", "culture", "food"], interests: ["Caucasus treks", "Supra feasts", "Wine"],
    bio: "Showing the world Svaneti before everyone else finds it.", countries: 9, followers: 760, following: 190, journeys: 8,
    socials: { instagram: "nino.trails" },
    plannedTrip: { destinationId: "svaneti", from: "2027-07-10", to: "2027-07-18", note: "Mestia → Ushguli 4-day trek. Looking for 2–3 hikers." },
  },
  {
    id: "thando", name: "Thando Nkosi", handle: "thando.outside", hue: 45, level: 5, home: "Cape Town, SA", verified: true,
    styles: ["adventure", "sports", "food"], interests: ["Trail running", "Surf", "Braai"],
    bio: "Table Mountain is my gym.", countries: 17, followers: 2100, following: 260, journeys: 13,
    socials: { strava: "thando.runs", instagram: "thando.outside" },
  },
];

export const travelerById = (id: string) => TRAVELERS.find((t) => t.id === id);

export const GROUPS: GroupExpedition[] = [
  {
    id: "g-patagonia", title: "Patagonia W-Trek November Crew", destinationId: "patagonia",
    from: "2026-11-08", to: "2026-11-18", kind: "Trekking", leaderId: "mateo",
    memberIds: ["mateo", "thando", "alina", "nino", "kenji"], capacity: 8,
    blurb: "Five days on the W with refugio nights. Moderate fitness, big views.",
    scene: s("mountain", "#8FB7D9", "#E5EEF5", "#56708C", "#2A3A2E"),
  },
  {
    id: "g-lisbon", title: "Lisbon Surfing & Remote Work Villa", destinationId: "lisbon",
    from: "2026-11-09", to: "2026-11-23", kind: "Coliving", leaderId: "marcos",
    memberIds: ["marcos", "devonliam", "giulia", "elena"], capacity: 6,
    blurb: "Co-work by day, dawn sessions at Carcavelos, Web Summit side-events.",
    scene: s("coast", "#F6C28B", "#FCEBD5", "#D9886A", "#5A6B8C"),
  },
  {
    id: "g-kyoto", title: "Kyoto Autumn Photo Walks", destinationId: "kyoto",
    from: "2026-11-16", to: "2026-11-22", kind: "Photography", leaderId: "chiyo",
    memberIds: ["chiyo", "elena", "kenji"], capacity: 6,
    blurb: "Dawn walks through Arashiyama, Ohara and Kurama with a local guide.",
    scene: s("temple", "#F7C59F", "#F2E6D8", "#B44A2C", "#3D2B25"),
  },
  {
    id: "g-svaneti", title: "Svaneti Tower Trek", destinationId: "svaneti",
    from: "2027-07-10", to: "2027-07-18", kind: "Trekking", leaderId: "nino",
    memberIds: ["nino"], capacity: 4,
    blurb: "Mestia to Ushguli with guesthouse supras every night.",
    scene: s("mountain", "#9FC3E7", "#EAF1F7", "#6F86A3", "#2F3D4F"),
  },
];

export const PULSE: PulseEvent[] = [
  { id: "p1", destinationId: "tokyo", city: "Tokyo", category: "sports", title: "Tokyo Marathon Gathering", summary: "Over 1,200 international runners meeting for a shakeout run around the Imperial Palace.", minutesAgo: 18, scene: s("city", "#3B2C5E", "#E77F67", "#2B2442", "#141026") },
  { id: "p2", destinationId: "lisbon", city: "Lisbon", category: "tech", title: "Web Summit Unofficial Side Events", summary: "Alfama terrace coworking sessions and founder sunset drinks all week.", minutesAgo: 42, scene: s("coast", "#F6C28B", "#FCEBD5", "#D9886A", "#5A6B8C") },
  { id: "p3", destinationId: "milan", city: "Milan", category: "fashion", title: "Design Week Nomadic Pop-ups", summary: "Brera district subterranean galleries opening to the public after dark.", minutesAgo: 64, scene: s("city", "#E9B9A0", "#F7E7DC", "#9C6B5A", "#3E2C2A") },
  { id: "p4", destinationId: "oaxaca", city: "Oaxaca", category: "art", title: "Día de Muertos Comparsas", summary: "Street parades through Xoxocotlán with marigold altars and brass bands.", minutesAgo: 95, scene: s("desert", "#F59E6B", "#FCE2C9", "#B5543A", "#4E2A23") },
  { id: "p5", destinationId: "reykjavik", city: "Reykjavík", category: "music", title: "Iceland Airwaves Off-Venue", summary: "Free shows in record shops, hostels and a geothermal pool.", minutesAgo: 130, scene: s("mountain", "#2F3E5C", "#7FA3C9", "#3E5C6E", "#1A2733") },
  { id: "p6", destinationId: "nyc", city: "New York", category: "sports", title: "NYC Marathon Cheer Zones", summary: "Best spots in Brooklyn and the Bronx to cheer 50,000 runners.", minutesAgo: 180, scene: s("city", "#E4A4A0", "#F6DDD6", "#5E5A75", "#25233A") },
  { id: "p7", destinationId: "melbourne", city: "Melbourne", category: "food", title: "Laneway Night Noodle Markets", summary: "Hawker stalls take over Birrarung Marr for three weeks.", minutesAgo: 240, scene: s("city", "#A7C7E7", "#EAF2FA", "#5C6F86", "#22303F") },
  { id: "p8", destinationId: "capetown", city: "Cape Town", category: "tech", title: "Africa Tech Week Meetups", summary: "Startup demos at the V&A Waterfront with sundowners after.", minutesAgo: 300, scene: s("mountain", "#F4A88A", "#FBE4D6", "#6E7F8E", "#2A3540") },
  { id: "p9", destinationId: "nyc", city: "New York", category: "fashion", title: "SoHo Sample Sale Season", summary: "Designer studios opening archive sales through the weekend.", minutesAgo: 360, scene: s("city", "#E4A4A0", "#F6DDD6", "#5E5A75", "#25233A") },
];

export const NEWS: NewsItem[] = [
  { id: "n1", destinationId: "kyoto", kind: "alert", title: "Autumn foliage peaks in Kurama & Kibune this week", body: "Eizan Electric Railway extends maple-tunnel night trains till 23:45. Peak crowds expected around 19:30.", hoursAgo: 2 },
  { id: "n2", destinationId: "kyoto", kind: "intel", title: "Fushimi Inari sunrise corridor: No permits needed", body: "Low pedestrian congestion registered prior to 07:00 AM. Golden light peaks through upper Senbon Torii.", hoursAgo: 5, match: 98 },
  { id: "n3", destinationId: "kyoto", kind: "event", title: "Maple illuminations begin at Eikandō", body: "Evening light-ups run nightly 17:30–20:30 through Dec 3.", hoursAgo: 20 },
  { id: "n4", destinationId: "lisbon", kind: "event", title: "Web Summit 2026 runs Nov 9–12", body: "Metro Line Red adds late trains to Oriente station all week.", hoursAgo: 3 },
  { id: "n5", destinationId: "lisbon", kind: "alert", title: "Tram 28 partial closure", body: "Graça section closed for maintenance until Nov 30; replacement bus 728.", hoursAgo: 11 },
  { id: "n6", destinationId: "tokyo", kind: "intel", title: "New late-night Yamanote service trial", body: "Weekend trains extended to 01:30 for a three-month pilot.", hoursAgo: 7, match: 91 },
  { id: "n7", destinationId: "patagonia", kind: "alert", title: "Grey Glacier route reopened", body: "Bridge repairs complete; the full W circuit is open for the season.", hoursAgo: 16 },
  { id: "n8", destinationId: "svaneti", kind: "intel", title: "Mestia airport adds summer flights", body: "Tbilisi–Mestia twin-otter flights move to daily from June.", hoursAgo: 30, match: 87 },
  { id: "n9", destinationId: "kravice", kind: "event", title: "Swimming season opens May 1", body: "Kayak rentals and the riverside mill restaurant reopen.", hoursAgo: 40 },
  { id: "n10", destinationId: "milan", kind: "event", title: "Salone del Mobile dates announced", body: "April 13–18, 2027. Fuorisalone district maps release in March.", hoursAgo: 22 },
  { id: "n11", destinationId: "oaxaca", kind: "alert", title: "Día de Muertos crowds peak Nov 1–2", body: "Book cemetery night tours ahead; colectivos to Xoxo fill by 20:00.", hoursAgo: 9 },
  { id: "n12", destinationId: "reykjavik", kind: "intel", title: "Strong aurora forecast this week", body: "KP index 5 expected Thursday — head to Grótta lighthouse.", hoursAgo: 4, match: 94 },
];

export const FIELD_NOTES: FieldNote[] = [
  { id: "f1", destinationId: "kyoto", category: "Luggage transit", author: "@marcos_nomad", text: "Drop your bags at Kyoto Station Baggage Delivery before heading to Arashiyama; they arrive at your ryokan by 4 PM seamlessly.", votes: 342 },
  { id: "f2", destinationId: "kyoto", category: "Footwear advice", author: "@chiyo_explorer", text: "Otagi Nenbutsu-ji steps can get slick with morning dew on moss. Avoid leather-soled shoes; trail treads are best.", votes: 219 },
  { id: "f3", destinationId: "kyoto", category: "Sunset timing", author: "@kenji_visuals", text: "Between Soba and Gion stroll, pause at Kamogawa riverbank right at 17:15 for sunset reflections with local musicians.", votes: 184 },
  { id: "f4", destinationId: "lisbon", category: "Transit", author: "@two_nomads", text: "Get a Viva Viagem card and load 'zapping' credit — cheaper than single tickets on every tram and ferry.", votes: 260 },
  { id: "f5", destinationId: "patagonia", category: "Gear", author: "@mateo.andes", text: "Trekking poles are non-negotiable on the descent from Base Torres. Wind gusts hit 100 km/h.", votes: 301 },
  { id: "f6", destinationId: "svaneti", category: "Money", author: "@nino_trails", text: "No ATMs after Mestia. Bring cash in lari for guesthouses in Adishi and Ushguli.", votes: 144 },
  { id: "f7", destinationId: "tokyo", category: "Food", author: "@kenji_visuals", text: "Ticket-machine ramen shops: press the top-left button — it's always the house special.", votes: 412 },
];
