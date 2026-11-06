export type TravelStyle =
  | "culture"
  | "photography"
  | "vacation"
  | "adventure"
  | "sports"
  | "events"
  | "food"
  | "nightlife"
  | "eco"
  | "tech"
  | "fashion"
  | "wellness";

/** The kind of trip an itinerary is built around. */
export type TripStyle = "vacation" | "culture" | "adventure" | "sports" | "events" | "custom";

/** Categories for the worldwide social "Pulse" feed. */
export type PulseCategory = "sports" | "tech" | "fashion" | "art" | "music" | "food";

export type SceneKind = "mountain" | "water" | "city" | "temple" | "forest" | "desert" | "coast";

export interface Scene {
  kind: SceneKind;
  /** Sky top, sky bottom, far layer, near layer */
  palette: [string, string, string, string];
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  hiddenGem: boolean;
  /** 0–100; lower means fewer crowds */
  popularity: number;
  styles: TravelStyle[];
  tagline: string;
  description: string;
  bestTime: string;
  upvotes: number;
  tip: { text: string; author: string };
  scene: Scene;
}

export interface PulseEvent {
  id: string;
  destinationId: string;
  city: string;
  category: PulseCategory;
  title: string;
  summary: string;
  minutesAgo: number;
  scene: Scene;
}

export interface NewsItem {
  id: string;
  destinationId: string;
  kind: "alert" | "intel" | "event";
  title: string;
  body: string;
  hoursAgo: number;
  match?: number;
}

export interface SocialLinks {
  instagram?: string;
  x?: string;
  tiktok?: string;
  strava?: string;
}

export type Visibility = "public" | "verified" | "followers" | "private";

export interface PlannedTrip {
  destinationId: string;
  from: string; // ISO date
  to: string;
  note: string;
}

export interface Traveler {
  id: string;
  name: string;
  handle: string;
  hue: number;
  level: number;
  home: string;
  verified: boolean;
  styles: TravelStyle[];
  interests: string[];
  bio: string;
  countries: number;
  followers: number;
  following: number;
  journeys: number;
  socials: SocialLinks;
  plannedTrip?: PlannedTrip;
  /** Extra companions travelling with this person (for duo/group listings). */
  partySize?: number;
}

export interface GroupExpedition {
  id: string;
  title: string;
  destinationId: string;
  from: string;
  to: string;
  kind: string;
  leaderId: string;
  memberIds: string[];
  capacity: number;
  blurb: string;
  scene: Scene;
  createdByMe?: boolean;
}

export interface Stop {
  id: string;
  time: string; // "07:30"
  label?: string; // "Golden hour"
  title: string;
  description: string;
  tag: string;
  secret?: string;
  reserved?: string;
  transit?: string;
  done?: boolean;
  scene?: Scene;
}

export interface ItineraryDay {
  title: string;
  stops: Stop[];
}

export interface Trip {
  id: string;
  destinationId: string;
  title: string;
  style: TripStyle;
  startDate: string;
  days: ItineraryDay[];
}

export interface FieldNote {
  id: string;
  destinationId: string;
  category: string;
  author: string;
  text: string;
  votes: number;
  mine?: boolean;
}

export interface Profile {
  name: string;
  handle: string;
  home: string;
  bio: string;
  hue: number;
  styles: TravelStyle[];
  preferences: {
    pace: "slow" | "balanced" | "packed";
    budget: "shoestring" | "comfort" | "luxury";
    company: "solo" | "duo" | "group" | "family";
  };
  /** Country names (as in the world atlas) the user has visited. */
  visited: string[];
  /** Destination ids the user wants news about. */
  watching: string[];
  socials: SocialLinks;
}

export interface XpEvent {
  id: string;
  label: string;
  amount: number;
  at: number;
}
