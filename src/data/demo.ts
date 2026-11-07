import type { Profile } from "../types";

/**
 * Fictional people used ONLY in local demo mode so the community features have something
 * to show. They are never written to the production database.
 */
type DemoPerson = Pick<Profile, "id" | "handle" | "name" | "hue" | "home" | "bio" | "styles" | "visited" | "socials">;

export const DEMO_PEOPLE: DemoPerson[] = [
  { id: "demo-elena", handle: "elena_wander", name: "Elena Vance", hue: 18, home: "Austin, TX", bio: "Film photographer chasing early light and late ramen.", styles: ["photography", "culture", "food"], visited: ["Japan", "Mexico", "Italy", "Portugal"], socials: { instagram: "elena.frames" } },
  { id: "demo-chiyo", handle: "chiyo_explorer", name: "Chiyo Tanaka", hue: 340, home: "Kyoto, Japan", bio: "Kyoto local. I share the quiet side of my city.", styles: ["culture", "wellness", "photography"], visited: ["Japan", "South Korea", "Taiwan"], socials: { instagram: "chiyo.kyoto" } },
  { id: "demo-kenji", handle: "kenji_visuals", name: "Kenji Mori", hue: 260, home: "Tokyo, Japan", bio: "Neon and long exposures.", styles: ["photography", "tech", "nightlife"], visited: ["Japan", "United States of America", "Iceland"], socials: { instagram: "kenji.visuals" } },
  { id: "demo-mateo", handle: "mateo.andes", name: "Mateo Ruiz", hue: 120, home: "Santiago, Chile", bio: "Mountain guide. 40+ W-Treks led.", styles: ["adventure", "eco", "sports"], visited: ["Chile", "Argentina", "Peru", "Norway"], socials: { strava: "mateoruiz" } },
  { id: "demo-marcos", handle: "marcos_nomad", name: "Marcos Silva", hue: 30, home: "Lisbon, Portugal", bio: "Founder, surfer, coworking regular.", styles: ["tech", "nightlife", "sports"], visited: ["Portugal", "Spain", "Morocco"], socials: { x: "marcos_builds" } },
];

export const DEMO_TIPS: { destinationId: string; authorId: string; category: string; body: string; votes: number }[] = [
  { destinationId: "kyoto", authorId: "demo-marcos", category: "Luggage transit", body: "Drop your bags at Kyoto Station baggage delivery before heading to Arashiyama; they arrive at your ryokan by 4 PM.", votes: 342 },
  { destinationId: "kyoto", authorId: "demo-chiyo", category: "Footwear", body: "Otagi Nenbutsu-ji steps get slick with morning dew on the moss. Leather soles are a bad idea.", votes: 219 },
  { destinationId: "kyoto", authorId: "demo-kenji", category: "Timing", body: "Pause at the Kamogawa riverbank around 17:15 for sunset reflections and street musicians.", votes: 184 },
  { destinationId: "lisbon", authorId: "demo-marcos", category: "Transit", body: "Load 'zapping' credit on a Viva Viagem card; it's cheaper than single tickets on trams and ferries.", votes: 260 },
  { destinationId: "patagonia", authorId: "demo-mateo", category: "Gear", body: "Trekking poles are essential on the descent from Base Torres. Gusts can hit 100 km/h.", votes: 301 },
  { destinationId: "tokyo", authorId: "demo-kenji", category: "Food", body: "At ticket-machine ramen shops, the top-left button is almost always the house special.", votes: 412 },
];
