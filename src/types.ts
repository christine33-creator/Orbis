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

/** Categories for the Global Pulse feed. */
export type PulseCategory = "sports" | "tech" | "fashion" | "art" | "music" | "food" | "festival" | "other";

export type GemCategory = "viewpoint" | "food" | "nature" | "beach" | "culture" | "shop" | "experience" | "other";

export type ContentStatus = "pending" | "published" | "hidden" | "rejected";

export type ItemType = "destination" | "gem" | "event";

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
  scene: Scene;
}

export interface AuthorRef {
  id: string;
  handle: string;
  name: string;
  hue: number;
  /** Public URL of the profile photo, if any. */
  avatarUrl: string | null;
}

export interface Gem {
  id: string;
  authorId: string;
  /** Null when the author's profile is private or deleted. */
  author: AuthorRef | null;
  destinationId: string | null;
  name: string;
  description: string;
  tip: string;
  category: GemCategory;
  styles: TravelStyle[];
  lat: number;
  lng: number;
  country: string;
  photos: string[];
  status: ContentStatus;
  upvotes: number;
  saves: number;
  reports: number;
  createdAt: string;
  /** The community recommendation this gem was suggested from, if any. */
  sourcePostId?: string | null;
}

export interface NewGem {
  /** Set when the gem is suggested from a community recommendation (always reviewed first). */
  sourcePostId?: string | null;
  destinationId: string | null;
  name: string;
  description: string;
  tip: string;
  category: GemCategory;
  styles: TravelStyle[];
  lat: number;
  lng: number;
  country: string;
}

export interface PulseEvent {
  id: string;
  destinationId: string | null;
  city: string;
  category: PulseCategory;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string | null;
  url: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
}

export interface Tip {
  id: string;
  authorId: string;
  author: AuthorRef | null;
  destinationId: string;
  category: string;
  body: string;
  status: ContentStatus;
  votes: number;
  createdAt: string;
}

export interface SocialLinks {
  instagram?: string;
  x?: string;
  tiktok?: string;
  strava?: string;
}

export interface Preferences {
  pace: "slow" | "balanced" | "packed";
  budget: "shoestring" | "comfort" | "luxury";
  company: "solo" | "duo" | "group" | "family";
  /** Preferred UI language code, e.g. "es". */
  language?: string;
}

export type Role = "member" | "moderator" | "admin";

export interface Profile {
  id: string;
  handle: string;
  name: string;
  home: string;
  bio: string;
  hue: number;
  styles: TravelStyle[];
  preferences: Preferences;
  /** Country names (as in the world atlas) the user has visited. */
  visited: string[];
  /** Destination ids the user wants updates about. */
  watching: string[];
  socials: SocialLinks;
  visibility: "public" | "private";
  onboarded: boolean;
  role: Role;
  xp: number;
  avatarUrl: string | null;
  createdAt: string;
}

export type ProfilePatch = Partial<
  Pick<Profile, "handle" | "name" | "home" | "bio" | "hue" | "styles" | "preferences" | "visited" | "watching" | "socials" | "visibility" | "onboarded">
>;

export interface Save {
  itemType: ItemType;
  itemId: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  destinationId: string | null;
  title: string;
  style: TripStyle;
  startDate: string | null;
  days: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripItem {
  id: string;
  tripId: string;
  day: number;
  position: number;
  time: string | null;
  title: string;
  notes: string;
  itemType: ItemType | null;
  itemId: string | null;
  done: boolean;
}

export type NewTripItem = Omit<TripItem, "id" | "done" | "position"> & { position?: number };

export type ReportTarget = "gem" | "tip" | "profile" | "event" | "community" | "post" | "comment";
export type ReportReason = "spam" | "inappropriate" | "unsafe" | "inaccurate" | "harassment" | "other";

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
}

export interface XpEvent {
  id: string;
  amount: number;
  reason: string;
  ref: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/* ---------------------------------------------------------------- Community */

export type CommunityCategory = "place" | "interest" | "people";
export type CommunityRole = "member" | "moderator" | "owner";
export type PostKind = "discussion" | "question" | "recommendation" | "experience";

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: CommunityCategory;
  destinationId: string | null;
  country: string;
  styles: TravelStyle[];
  hue: number;
  official: boolean;
  createdBy: string | null;
  status: ContentStatus;
  memberCount: number;
  postCount: number;
  createdAt: string;
}

export type NewCommunity = Pick<Community, "name" | "description" | "category" | "destinationId" | "country" | "styles" | "hue">;

export interface CommunityRef {
  id: string;
  name: string;
  hue: number;
}

export interface Membership {
  communityId: string;
  role: CommunityRole;
  joinedAt: string;
}

export interface Member extends AuthorRef {
  role: CommunityRole;
}

export interface Post {
  id: string;
  communityId: string;
  community: CommunityRef | null;
  authorId: string;
  /** Null when the author's profile is private or deleted. */
  author: AuthorRef | null;
  kind: PostKind;
  title: string;
  body: string;
  destinationId: string | null;
  place: string;
  photos: string[];
  status: ContentStatus;
  likes: number;
  comments: number;
  saves: number;
  reports: number;
  createdAt: string;
  editedAt: string | null;
}

export interface NewPost {
  communityId: string;
  kind: PostKind;
  title: string;
  body: string;
  destinationId: string | null;
  place: string;
}

export type PostPatch = Partial<Omit<NewPost, "communityId">>;

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: AuthorRef | null;
  body: string;
  status: ContentStatus;
  createdAt: string;
  editedAt: string | null;
}

export interface ProfileStats {
  followers: number;
  following: number;
  gems: number;
  posts: number;
  communities: number;
}

export interface PostFilter {
  communityId?: string;
  communityIds?: string[];
  authorId?: string;
  ids?: string[];
  destinationId?: string;
  limit?: number;
}
