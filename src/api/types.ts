import type { en } from "../i18n/locales/en";
import type {
  AuthUser, AuthorRef, Comment, Community, ContentStatus, Destination, Gem, ItemType, Member, Membership, NewCommunity, NewGem,
  NewPost, NewTripItem, Post, PostFilter, PostPatch, Profile, ProfilePatch, ProfileStats, PulseEvent, Report, ReportReason,
  ReportTarget, Save, Tip, Trip, TripItem, XpEvent,
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
  posts: Post[];
  comments: Comment[];
  communities: Community[];
  reports: Report[];
}

export type ModerationTarget = "gem" | "tip" | "post" | "comment" | "community";

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
  /** Fires when someone arrives from a password-reset email (they are signed in and must choose a new password). */
  onPasswordRecovery(cb: () => void): () => void;
  /** Which third-party sign-in providers are enabled on the backend. */
  authProviders(): Promise<{ google: boolean }>;
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password. Pass the current password to re-verify it first (Settings); omit it after a reset link. */
  updatePassword(newPassword: string, currentPassword?: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  /** Starts an email change; Supabase sends confirmation links before it takes effect. */
  changeEmail(newEmail: string): Promise<void>;
  deleteAccount(): Promise<void>;

  // Profiles
  getMyProfile(): Promise<Profile | null>;
  updateMyProfile(patch: ProfilePatch): Promise<Profile>;
  handleAvailable(handle: string): Promise<boolean>;
  getProfile(id: string): Promise<Profile | null>;
  followCounts(userId: string): Promise<{ followers: number; following: number }>;
  /** Public numbers for a profile; null when the profile is private (to the caller). */
  profileStats(userId: string): Promise<ProfileStats | null>;
  /** Uploads a new profile photo (already resized and stripped of metadata) and sets it. */
  setAvatar(photo: Blob | null): Promise<Profile>;
  listFollowers(userId: string): Promise<AuthorRef[]>;
  listFollowees(userId: string): Promise<AuthorRef[]>;

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

  // Communities
  listCommunities(): Promise<Community[]>;
  getCommunity(id: string): Promise<Community | null>;
  createCommunity(c: NewCommunity): Promise<Community>;
  updateCommunity(id: string, patch: Partial<NewCommunity>): Promise<void>;
  deleteCommunity(id: string): Promise<void>;
  myMemberships(): Promise<Membership[]>;
  setMembership(communityId: string, on: boolean): Promise<void>;
  listMembers(communityId: string): Promise<Member[]>;
  /** Owners only (the server enforces it). */
  setMemberRole(communityId: string, userId: string, role: "member" | "moderator"): Promise<void>;
  removeMember(communityId: string, userId: string): Promise<void>;
  /** Communities a person belongs to (respects their privacy). */
  communitiesOf(userId: string): Promise<Community[]>;

  // Posts
  listPosts(filter: PostFilter): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(post: NewPost, photos: Blob[]): Promise<Post>;
  updatePost(id: string, patch: PostPatch): Promise<void>;
  deletePost(id: string): Promise<void>;
  myLikes(): Promise<string[]>;
  setLike(postId: string, on: boolean): Promise<void>;
  mySavedPosts(): Promise<string[]>;
  setPostSaved(postId: string, on: boolean): Promise<void>;
  listComments(postId: string): Promise<Comment[]>;
  createComment(postId: string, body: string): Promise<Comment>;
  updateComment(id: string, body: string): Promise<void>;
  deleteComment(id: string): Promise<void>;
  /** The gem suggested from this post, if the caller can see it (published, or their own). */
  gemFromPost(postId: string): Promise<Gem | null>;

  // Engagement
  xpHistory(): Promise<XpEvent[]>;

  // Moderation (moderators only; the server enforces it)
  moderationQueue(): Promise<ModerationQueue>;
  moderate(targetType: ModerationTarget, id: string, status: ContentStatus, note: string): Promise<void>;
  resolveReport(id: string, status: "resolved" | "dismissed"): Promise<void>;
}

/** Error codes map to `errors.<code>` in the locale files. */
export type ErrorCode = keyof typeof en.errors;

/** An error people can be shown, translated from its code by the UI. */
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, readonly params?: Record<string, string>) {
    super(code);
  }
}
