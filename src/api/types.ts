import type {
  AuthUser, ContentStatus, Destination, Gem, ItemType, NewGem, NewTripItem, Profile, ProfilePatch, PulseEvent,
  Report, ReportReason, ReportTarget, Save, Tip, Trip, TripItem, XpEvent,
} from "../types";

export interface NewTrip {
  destinationId: string | null;
  title: string;
  style: Trip["style"];
  startDate: string | null;
  days: number;
}

export interface ModerationQueue {
  gems: Gem[];
  tips: Tip[];
  reports: Report[];
}

/** Everything the UI needs from a backend. Implemented by Supabase and by a local demo store. */
export interface Api {
  mode: "supabase" | "local";

  // Auth
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  sendMagicLink(email: string): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUpWithPassword(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;

  // Profiles
  getMyProfile(): Promise<Profile | null>;
  updateMyProfile(patch: ProfilePatch): Promise<Profile>;
  handleAvailable(handle: string): Promise<boolean>;
  getProfile(id: string): Promise<Profile | null>;
  followCounts(userId: string): Promise<{ followers: number; following: number }>;

  // Discovery
  listDestinations(): Promise<Destination[]>;
  /** Published gems plus the caller's own (any status). */
  listGems(): Promise<Gem[]>;
  getGem(id: string): Promise<Gem | null>;
  createGem(gem: NewGem, photos: Blob[]): Promise<Gem>;
  deleteGem(id: string): Promise<void>;
  myUpvotes(): Promise<string[]>;
  setUpvote(gemId: string, on: boolean): Promise<void>;
  listEvents(): Promise<PulseEvent[]>;
  listTips(destinationId: string): Promise<Tip[]>;
  createTip(destinationId: string, category: string, body: string): Promise<Tip>;
  deleteTip(id: string): Promise<void>;
  myTipVotes(): Promise<string[]>;
  setTipVote(tipId: string, on: boolean): Promise<void>;

  // Saves
  listSaves(): Promise<Save[]>;
  setSaved(itemType: ItemType, itemId: string, on: boolean): Promise<void>;

  // Trips
  listTrips(): Promise<Trip[]>;
  createTrip(trip: NewTrip): Promise<Trip>;
  updateTrip(id: string, patch: Partial<NewTrip & { notes: string }>): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  listTripItems(tripId: string): Promise<TripItem[]>;
  addTripItems(items: NewTripItem[]): Promise<void>;
  updateTripItem(id: string, patch: Partial<Pick<TripItem, "day" | "position" | "time" | "title" | "notes" | "done">>): Promise<void>;
  deleteTripItem(id: string): Promise<void>;

  // Community & safety
  listFollowing(): Promise<string[]>;
  setFollow(userId: string, on: boolean): Promise<void>;
  listBlocks(): Promise<string[]>;
  setBlock(userId: string, on: boolean): Promise<void>;
  report(targetType: ReportTarget, targetId: string, reason: ReportReason, details: string): Promise<void>;

  // Engagement
  xpHistory(): Promise<XpEvent[]>;

  // Moderation (moderators only; the server enforces it)
  moderationQueue(): Promise<ModerationQueue>;
  moderate(targetType: "gem" | "tip", id: string, status: ContentStatus, note: string): Promise<void>;
  resolveReport(id: string, status: "resolved" | "dismissed"): Promise<void>;
}

/** An error whose message is safe to show to people. */
export class ApiError extends Error {}
