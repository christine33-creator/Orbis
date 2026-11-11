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

/** Demo-only community posts by the fictional people above. Never written to production. */
export const DEMO_POSTS: {
  key: string; community: string; authorId: string; kind: "discussion" | "question" | "recommendation" | "experience";
  title: string; body: string; destinationId: string | null; place: string; hoursAgo: number; likedBy: string[];
  comments: { authorId: string; body: string }[];
}[] = [
  {
    key: "kyoto-moss", community: "japan-travel-club", authorId: "demo-chiyo", kind: "recommendation", title: "Gio-ji moss garden before 9 AM",
    body: "Most people rush to Kokedera, which needs a postcard booking. Gio-ji is a ten minute walk from the Arashiyama bamboo grove, costs 300 yen and is almost empty right at opening. Go after rain for the deepest green.",
    destinationId: "kyoto", place: "Gio-ji, Arashiyama", hoursAgo: 5, likedBy: ["demo-elena", "demo-kenji"],
    comments: [{ authorId: "demo-elena", body: "Went last spring on your tip. Unreal light through the maples." }],
  },
  {
    key: "jr-pass", community: "japan-travel-club", authorId: "demo-elena", kind: "question", title: "Is the JR Pass still worth it for Tokyo → Kyoto → Osaka?",
    body: "Ten days, mostly Tokyo and Kansai, one day trip to Nara. After the price rise I'm not sure the pass pays off. What did you do?",
    destinationId: "tokyo", place: "", hoursAgo: 20, likedBy: ["demo-marcos"],
    comments: [{ authorId: "demo-kenji", body: "For that route, single Shinkansen tickets plus an ICOCA card came out cheaper for me." }, { authorId: "demo-chiyo", body: "Agree with Kenji. Buy the Kansai trains as you go." }],
  },
  {
    key: "solo-lisbon", community: "solo-explorers", authorId: "demo-marcos", kind: "experience", title: "Three weeks solo in Lisbon: what worked",
    body: "Coworking in Cais do Sodré was the easiest way to meet people. Thursday free walking tours from Praça do Comércio turned into dinners. Alfama at night felt safe, but watch the cobbles after rain.",
    destinationId: "lisbon", place: "Cais do Sodré", hoursAgo: 30, likedBy: ["demo-elena", "demo-mateo", "demo-chiyo"],
    comments: [],
  },
  {
    key: "w-trek", community: "trail-summit", authorId: "demo-mateo", kind: "discussion", title: "W Trek: east to west or west to east?",
    body: "I've guided both directions. East to west saves Base Torres for the first full day when legs are fresh, west to east ends with the towers at sunrise. Which did you prefer?",
    destinationId: "patagonia", place: "Torres del Paine", hoursAgo: 48, likedBy: ["demo-kenji"],
    comments: [{ authorId: "demo-marcos", body: "West to east. Ending at the towers felt like the right finale." }],
  },
];
