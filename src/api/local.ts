import type { Api, ModerationQueue, NewTrip } from "./types";
import { ApiError } from "./types";
import type {
  AuthUser, AuthorRef, Comment, Community, CommunityRole, ContentStatus, Gem, ItemType, Member, NewCommunity, Post, Profile,
  PulseEvent, Report, Tip, Trip, TripItem, XpEvent,
} from "../types";
import { DESTINATIONS } from "../data/destinations";
import { GEM_SEEDS } from "../data/gems";
import { EVENT_SEEDS } from "../data/events";
import { DEMO_PEOPLE, DEMO_POSTS, DEMO_TIPS } from "../data/demo";
import { COMMUNITY_SEEDS } from "../data/communities";
import { DAILY_LIMITS, HANDLE_RE, REPORT_HIDE_THRESHOLD, XP_AWARDS, XP_DAILY_CAPS, needsReview, slugify, type XpReason } from "../lib/rules";

/**
 * Browser-only backend for demos and development. Data lives in localStorage on this
 * device. It applies the same rules as the database so the app behaves the same way.
 */

const KEY = "orbis-local-db-v1";
const TEAM_ID = "orbis-team";

type Owned<T> = T & { userId: string };

interface Db {
  version: 1;
  currentUserId: string | null;
  users: AuthUser[];
  profiles: Profile[];
  gems: Gem[];
  upvotes: { gemId: string; userId: string }[];
  tips: Tip[];
  tipVotes: { tipId: string; userId: string }[];
  events: PulseEvent[];
  saves: Owned<{ itemType: ItemType; itemId: string; createdAt: string }>[];
  trips: Owned<Trip>[];
  items: TripItem[];
  follows: { followerId: string; followeeId: string }[];
  blocks: { blockerId: string; blockedId: string }[];
  reports: Report[];
  xp: Owned<XpEvent>[];
  communities: Community[];
  members: { communityId: string; userId: string; role: CommunityRole; joinedAt: string }[];
  posts: Post[];
  comments: Comment[];
  likes: { postId: string; userId: string; createdAt: string }[];
  postSaves: { postId: string; userId: string; createdAt: string }[];
}

const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const dayAgo = () => Date.now() - 86400000;

function baseProfile(p: Partial<Profile> & Pick<Profile, "id" | "handle">): Profile {
  return {
    name: "", home: "", bio: "", hue: 20, styles: [], visited: [], watching: [], socials: {},
    preferences: { pace: "balanced", budget: "comfort", company: "solo" }, visibility: "public",
    onboarded: true, role: "member", xp: 0, avatarUrl: null, createdAt: now(), ...p,
  };
}

/** Official starter communities, plus (demo only) a few fictional members and posts. */
function seedCommunities(db: Db) {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  db.communities = COMMUNITY_SEEDS.map((c) => ({
    id: `community-${c.slug}`, slug: c.slug, name: c.name, description: c.description, category: c.category, destinationId: c.destinationId,
    country: c.country, styles: c.styles, hue: c.hue, official: true, createdBy: null, status: "published", memberCount: 0, postCount: 0, createdAt: ago(24 * 90),
  }));
  db.members = []; db.posts = []; db.comments = []; db.likes = []; db.postSaves = [];
  for (const p of DEMO_POSTS) {
    const cid = `community-${p.community}`;
    for (const uid of [p.authorId, ...p.likedBy]) {
      if (!db.members.some((m) => m.communityId === cid && m.userId === uid)) db.members.push({ communityId: cid, userId: uid, role: "member", joinedAt: ago(24 * 30) });
    }
    db.posts.push({
      id: `post-${p.key}`, communityId: cid, community: null, authorId: p.authorId, author: null, kind: p.kind, title: p.title, body: p.body,
      destinationId: p.destinationId, place: p.place, photos: [], status: "published", likes: p.likedBy.length, comments: p.comments.length,
      saves: 0, reports: 0, createdAt: ago(p.hoursAgo), editedAt: null,
    });
    p.likedBy.forEach((uid) => db.likes.push({ postId: `post-${p.key}`, userId: uid, createdAt: ago(p.hoursAgo - 1) }));
    p.comments.forEach((c, i) => {
      if (!db.members.some((m) => m.communityId === cid && m.userId === c.authorId)) db.members.push({ communityId: cid, userId: c.authorId, role: "member", joinedAt: ago(24 * 30) });
      db.comments.push({ id: `comment-${p.key}-${i}`, postId: `post-${p.key}`, authorId: c.authorId, author: null, body: c.body, status: "published", createdAt: ago(p.hoursAgo - 2 - i), editedAt: null });
    });
  }
  for (const c of db.communities) {
    c.memberCount = db.members.filter((m) => m.communityId === c.id).length;
    c.postCount = db.posts.filter((p) => p.communityId === c.id).length;
  }
}

function seed(): Db {
  const team = baseProfile({ id: TEAM_ID, handle: "orbis_team", name: "Orbis Team", hue: 12, bio: "Starter picks from the Orbis editors." });
  const people = DEMO_PEOPLE.map((p) => baseProfile({ ...p, xp: 400 + p.name.length * 90 }));
  const authorRef = (p: Profile) => ({ id: p.id, handle: p.handle, name: p.name, hue: p.hue, avatarUrl: null });
  const gems: Gem[] = GEM_SEEDS.map((g, i) => ({
    id: `gem-${g.key}`, authorId: TEAM_ID, author: authorRef(team), destinationId: g.destinationId, name: g.name,
    description: g.description, tip: g.tip, category: g.category, styles: g.styles, lat: g.lat, lng: g.lng,
    country: g.country, photos: [], status: "published", upvotes: 40 + ((i * 37) % 180), saves: 10 + ((i * 13) % 60),
    reports: 0, createdAt: new Date(Date.now() - i * 3600_000 * 7).toISOString(),
  }));
  const events: PulseEvent[] = EVENT_SEEDS.map((e) => {
    const d = DESTINATIONS.find((x) => x.id === e.destinationId);
    return {
      id: `event-${e.key}`, destinationId: e.destinationId, city: e.city, category: e.category, title: e.title,
      summary: e.summary, startsAt: new Date(Date.now() + e.startInDays * 86400000).toISOString(),
      endsAt: new Date(Date.now() + (e.startInDays + e.lengthDays) * 86400000).toISOString(), url: null, imageUrl: null,
      lat: d?.lat ?? null, lng: d?.lng ?? null, source: "sample",
    };
  });
  const tips: Tip[] = DEMO_TIPS.map((t, i) => {
    const author = people.find((p) => p.id === t.authorId)!;
    return {
      id: `tip-${i}`, authorId: author.id, author: authorRef(author), destinationId: t.destinationId, category: t.category,
      body: t.body, status: "published", votes: t.votes, createdAt: now(),
    };
  });
  const db: Db = {
    version: 1, currentUserId: null, users: [], profiles: [team, ...people], gems, upvotes: [], tips, tipVotes: [],
    events, saves: [], trips: [], items: [], follows: [], blocks: [], reports: [], xp: [],
    communities: [], members: [], posts: [], comments: [], likes: [], postSaves: [],
  };
  seedCommunities(db);
  return db;
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Db;
      if (db.version === 1) {
        // Demo data saved before Community existed.
        if (!db.communities) seedCommunities(db);
        db.profiles.forEach((p) => (p.avatarUrl ??= null));
        return db;
      }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return seed();
}

export function createLocalApi(): Api {
  let db = load();
  const listeners = new Set<(u: AuthUser | null) => void>();

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      throw new ApiError("storageFull");
    }
  };
  // Return copies, like a network API would; handing out internal objects breaks change detection.
  const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 60));
  const me = () => {
    const uid = db.currentUserId;
    if (!uid) throw new ApiError("signInFirst");
    return uid;
  };
  const profile = (uid: string) => db.profiles.find((p) => p.id === uid);
  const isMod = () => {
    const p = db.currentUserId ? profile(db.currentUserId) : undefined;
    return p?.role === "moderator" || p?.role === "admin";
  };
  const blockedByMe = (author: string) => db.blocks.some((b) => b.blockerId === db.currentUserId && b.blockedId === author);
  const canView = (uid: string) => {
    const p = profile(uid);
    return !!p && (p.visibility === "public" || uid === db.currentUserId || isMod());
  };
  const authorRef = (uid: string): AuthorRef | null => {
    const p = profile(uid);
    if (!p || (p.visibility === "private" && uid !== db.currentUserId)) return null;
    return { id: p.id, handle: p.handle, name: p.name, hue: p.hue, avatarUrl: p.avatarUrl };
  };
  const countToday = <T extends { createdAt: string }>(rows: T[], owned: (r: T) => boolean) =>
    rows.filter((r) => owned(r) && new Date(r.createdAt).getTime() > dayAgo()).length;

  function award(uid: string, reason: XpReason, ref = "") {
    if (db.xp.some((x) => x.userId === uid && x.reason === reason && x.ref === ref)) return;
    const amount = XP_AWARDS[reason];
    const cap = XP_DAILY_CAPS[reason];
    if (cap !== undefined && db.xp.filter((x) => x.userId === uid && x.reason === reason && new Date(x.createdAt).getTime() > dayAgo()).reduce((n, x) => n + x.amount, 0) + amount > cap) return;
    db.xp.unshift({ id: id(), userId: uid, amount, reason, ref, createdAt: now() });
    const p = profile(uid);
    if (p) p.xp += amount;
  }

  function visibleGem(g: Gem) {
    return (g.status === "published" && !blockedByMe(g.authorId)) || g.authorId === db.currentUserId || isMod();
  }
  const withAuthor = <T extends { authorId: string }>(row: T) => ({ ...row, author: authorRef(row.authorId) });

  // Community rules (mirror the database policies) ----------------------------------------
  const roleIn = (cid: string, uid = db.currentUserId) => db.members.find((m) => m.communityId === cid && m.userId === uid)?.role;
  const isCommunityMod = (cid: string) => roleIn(cid) === "owner" || roleIn(cid) === "moderator";
  const community = (cid: string) => db.communities.find((c) => c.id === cid);
  const visibleCommunity = (c: Community) => c.status === "published" || c.createdBy === db.currentUserId || isMod() || isCommunityMod(c.id);
  const visiblePost = (p: Post) => {
    const c = community(p.communityId);
    return (p.status === "published" && !blockedByMe(p.authorId) && c?.status === "published") || p.authorId === db.currentUserId || isMod() || isCommunityMod(p.communityId);
  };
  const postOut = (p: Post): Post => {
    const c = community(p.communityId);
    return { ...p, author: authorRef(p.authorId), community: c ? { id: c.id, name: c.name, hue: c.hue } : null };
  };
  const visibleComment = (c: Comment) => {
    const post = db.posts.find((p) => p.id === c.postId);
    if (!post) return false;
    return (c.status === "published" && !blockedByMe(c.authorId) && post.status === "published") || c.authorId === db.currentUserId || isMod() || isCommunityMod(post.communityId);
  };
  const recount = (cid: string) => {
    const c = community(cid);
    if (!c) return;
    c.memberCount = db.members.filter((m) => m.communityId === cid).length;
    c.postCount = db.posts.filter((p) => p.communityId === cid && p.status === "published").length;
  };
  const setPostStatus = (p: Post, status: ContentStatus) => {
    const was = p.status;
    p.status = status;
    if (status === "published" && was !== "published") award(p.authorId, "post_published", p.id);
    recount(p.communityId);
  };
  const setCommentStatus = (c: Comment, status: ContentStatus) => {
    const post = db.posts.find((p) => p.id === c.postId);
    const was = c.status;
    c.status = status;
    if (post) post.comments = Math.max(0, post.comments + (status === "published" && was !== "published" ? 1 : was === "published" && status !== "published" ? -1 : 0));
  };

  const setUser = (u: AuthUser | null) => {
    db.currentUserId = u?.id ?? null;
    persist();
    listeners.forEach((l) => l(u));
  };

  function signIn(email: string) {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new ApiError("invalidEmail");
    let user = db.users.find((u) => u.email === clean);
    if (!user) {
      user = { id: id(), email: clean };
      db.users.push(user);
      // In the demo, every account can open the moderation queue so it can be tried out.
      db.profiles.push(baseProfile({ id: user.id, handle: `explorer_${user.id.replace(/-/g, "").slice(0, 8)}`, onboarded: false, role: "moderator", hue: Math.floor(Math.random() * 360) }));
    }
    setUser(user);
  }

  /**
   * Demo builds (VITE_DEMO_PERSONA=1) open already signed in as a pretend explorer with
   * a lived-in account: saves, an upcoming trip, shared gems, a note, follows and XP.
   */
  function seedPersona() {
    const uid = "demo-sophia";
    const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
    const visited = ["Japan", "Italy", "Portugal", "Spain", "Iceland", "Mexico", "Norway", "Georgia", "Morocco"];
    db.users.push({ id: uid, email: "sophia@demo.orbis" });
    db.profiles.push(baseProfile({
      id: uid, handle: "sophiatravels", name: "Sophia Thorne", home: "Lisbon, Portugal", hue: 20, role: "moderator",
      bio: "Alps enthusiast, specialty coffee hunter & architectural photographer. Always looking for unmapped trails.",
      styles: ["culture", "photography", "adventure", "food"], preferences: { pace: "balanced", budget: "comfort", company: "duo" },
      visited, watching: ["kyoto", "lisbon", "svaneti"], socials: { instagram: "sophia.lens", strava: "sophia.hikes" }, createdAt: ago(24 * 60),
    }));
    award(uid, "profile_completed");
    visited.forEach((c) => award(uid, "country_stamped", c));

    // Community: who she follows, who follows her.
    for (const f of ["demo-chiyo", "demo-elena"]) {
      db.follows.push({ followerId: uid, followeeId: f });
      award(uid, "followed", f);
    }
    for (const f of ["demo-elena", "demo-kenji", "demo-marcos", "demo-mateo"]) db.follows.push({ followerId: f, followeeId: uid });

    // Gems she found: one live with upvotes, one waiting for review because it has a link.
    const live: Gem = {
      id: "gem-sophia-graca", authorId: uid, author: null, destinationId: "lisbon", name: "Graça Tile Workshop",
      description: "A tiny azulejo studio on a back street in Graça where you can paint your own tile and fire it the same week. The owner explains the patterns of every old façade nearby.",
      tip: "Book the Saturday morning class and pick your tile up on Tuesday.", category: "experience", styles: ["culture", "photography"],
      lat: 38.7165, lng: -9.1305, country: "Portugal", photos: [], status: "published", upvotes: 0, saves: 9, reports: 0, createdAt: ago(24 * 12),
    };
    const pending: Gem = {
      id: "gem-sophia-cascais", authorId: uid, author: null, destinationId: "lisbon", name: "Sunrise Kayak to Boca do Inferno",
      description: "Calm-water sunrise paddle along the Cascais cliffs to the sea arch, with almost nobody else on the water. Rentals at www.example.com",
      tip: "Only on low-wind mornings; check the forecast the night before.", category: "nature", styles: ["adventure", "eco"],
      lat: 38.6914, lng: -9.4316, country: "Portugal", photos: [], status: "pending", upvotes: 0, saves: 0, reports: 0, createdAt: ago(5),
    };
    db.gems.unshift(pending, live);
    award(uid, "gem_published", live.id);
    for (const v of ["demo-elena", "demo-chiyo", "demo-marcos", "demo-kenji"]) {
      db.upvotes.push({ gemId: live.id, userId: v });
      live.upvotes++;
      award(uid, "upvote_received", `${live.id}:${v}`);
    }
    db.tips.unshift({
      id: "tip-sophia", authorId: uid, author: null, destinationId: "kyoto", category: "Photography",
      body: "For empty shots of the bamboo grove, enter from the Tenryū-ji north gate side at opening time.", status: "published", votes: 12, createdAt: ago(24 * 20),
    });
    award(uid, "tip_published", "tip-sophia");

    // Saves.
    const saves: [ItemType, string][] = [
      ["destination", "kyoto"], ["gem", "gem-otagi"], ["gem", "gem-saga-toriimoto"], ["gem", "gem-kibune"], ["event", "event-kyoto-festival"],
      ["destination", "svaneti"], ["gem", "gem-ushguli"], ["gem", "gem-yanaka"],
    ];
    saves.forEach(([itemType, itemId], i) => {
      db.saves.push({ userId: uid, itemType, itemId, createdAt: ago(30 + i * 20) });
      award(uid, "saved", `${itemType}:${itemId}`);
    });

    // An upcoming trip built from those saves, and a past one with check-ins.
    const trip = (id: string, destinationId: string, title: string, style: Trip["style"], startDate: string, days: number, created: number) => {
      db.trips.push({ id, userId: uid, destinationId, title, style, startDate, days, notes: "", createdAt: ago(created), updatedAt: ago(created) });
      award(uid, "trip_created", id);
    };
    trip("trip-kyoto", "kyoto", "Kyoto Autumn Odyssey", "culture", inDays(12), 4, 26);
    trip("trip-lisbon", "lisbon", "Lisbon Long Weekend", "vacation", inDays(-40), 2, 24 * 50);
    const item = (tripId: string, day: number, position: number, time: string | null, title: string, notes: string, itemType: ItemType | null, itemId: string | null, done = false) => {
      db.items.push({ id: `${tripId}-${day}-${position}`, tripId, day, position, time, title, notes, itemType, itemId, done });
      if (done) award(uid, "stop_done", `${tripId}-${day}-${position}`);
    };
    item("trip-kyoto", 0, 0, "07:30", "Saga-Toriimoto Preserved Street", "Walk north out of the bamboo grove.", "gem", "gem-saga-toriimoto");
    item("trip-kyoto", 0, 1, "10:00", "Otagi Nenbutsu-ji", "Shoes with grip for the mossy steps.", "gem", "gem-otagi");
    item("trip-kyoto", 0, 2, "18:30", "Dinner in Pontochō", "Table for 2 booked, ref 4471.", null, null);
    item("trip-kyoto", 1, 0, "06:30", "Fushimi Inari before the crowds", "Turn right at Yotsutsuji for the city view.", null, null);
    item("trip-kyoto", 1, 1, "18:00", "Autumn Maple Light-ups", "", "event", "event-kyoto-festival");
    item("trip-kyoto", 2, 0, "09:00", "Kibune Shrine", "Hike over from Kurama, lunch on the river platforms.", "gem", "gem-kibune");
    item("trip-kyoto", 3, 0, "11:00", "Shinkansen to Tokyo", "Nozomi from Kyoto Station, car 7.", null, null);
    item("trip-lisbon", 0, 0, "09:00", "Pastéis de nata in Belém", "", null, null, true);
    item("trip-lisbon", 0, 1, "19:30", "Miradouro da Senhora do Monte", "Sunset with a bottle of vinho verde.", "gem", "gem-senhora-monte", true);
    item("trip-lisbon", 1, 0, "11:00", "LX Factory bookshops", "", null, null);

    // Spread the XP history over the past weeks so it reads naturally.
    db.xp.filter((x) => x.userId === uid).forEach((x, i) => (x.createdAt = ago(4 + i * 14)));
    db.currentUserId = uid;
    persist();
  }
  if (import.meta.env.VITE_DEMO_PERSONA && db.users.length === 0) seedPersona();

  const api: Api = {
    mode: "local",

    getUser: async () => delay(db.users.find((u) => u.id === db.currentUserId) ?? null),
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async sendMagicLink(email) {
      signIn(email);
    },
    async signInWithPassword(email) {
      signIn(email);
    },
    async signUpWithPassword(email) {
      signIn(email);
      return { needsConfirmation: false };
    },
    async signInWithGoogle() {
      signIn("demo.google@orbis.local");
    },
    async signOut() {
      setUser(null);
    },
    onPasswordRecovery() {
      return () => undefined;
    },
    authProviders: async () => ({ google: true }),
    // The demo has no email: these succeed without sending anything.
    async requestPasswordReset(email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new ApiError("invalidEmail");
    },
    async updatePassword() {
      me();
    },
    async resendVerification() {},
    async changeEmail(newEmail) {
      const uid = me();
      const clean = newEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new ApiError("invalidEmail");
      if (db.users.some((u) => u.email === clean && u.id !== uid)) throw new ApiError("emailTaken");
      const u = db.users.find((x) => x.id === uid);
      if (u) u.email = clean;
      persist();
    },
    async deleteAccount() {
      const uid = me();
      db.users = db.users.filter((u) => u.id !== uid);
      db.profiles = db.profiles.filter((p) => p.id !== uid);
      db.gems = db.gems.filter((g) => g.authorId !== uid);
      db.tips = db.tips.filter((t) => t.authorId !== uid);
      db.saves = db.saves.filter((s) => s.userId !== uid);
      const tripIds = new Set(db.trips.filter((t) => t.userId === uid).map((t) => t.id));
      db.trips = db.trips.filter((t) => t.userId !== uid);
      db.items = db.items.filter((i) => !tripIds.has(i.tripId));
      db.follows = db.follows.filter((f) => f.followerId !== uid && f.followeeId !== uid);
      db.blocks = db.blocks.filter((b) => b.blockerId !== uid && b.blockedId !== uid);
      db.upvotes = db.upvotes.filter((u) => u.userId !== uid);
      db.xp = db.xp.filter((x) => x.userId !== uid);
      const owned = new Set(db.members.filter((m) => m.userId === uid && m.role === "owner").map((m) => m.communityId));
      db.communities = db.communities.filter((c) => !owned.has(c.id));
      db.communities.forEach((c) => c.createdBy === uid && (c.createdBy = null));
      db.members = db.members.filter((m) => m.userId !== uid && !owned.has(m.communityId));
      const gonePosts = new Set(db.posts.filter((p) => p.authorId === uid || owned.has(p.communityId)).map((p) => p.id));
      db.posts = db.posts.filter((p) => !gonePosts.has(p.id));
      db.comments = db.comments.filter((c) => c.authorId !== uid && !gonePosts.has(c.postId));
      db.likes = db.likes.filter((l) => l.userId !== uid && !gonePosts.has(l.postId));
      db.postSaves = db.postSaves.filter((l) => l.userId !== uid && !gonePosts.has(l.postId));
      db.communities.forEach((c) => recount(c.id));
      setUser(null);
    },

    getMyProfile: async () => delay(db.currentUserId ? (profile(db.currentUserId) ?? null) : null),
    async updateMyProfile(patch) {
      const p = profile(me())!;
      if (patch.handle !== undefined) {
        if (!HANDLE_RE.test(patch.handle)) throw new ApiError("handleFormat");
        if (db.profiles.some((x) => x.handle === patch.handle && x.id !== p.id)) throw new ApiError("handleTaken");
      }
      const wasOnboarded = p.onboarded;
      const before = new Set(p.visited);
      // Same editable columns as the database grants; role and XP can't be set by the client.
      const allowed = ["handle", "name", "home", "bio", "hue", "styles", "preferences", "visited", "watching", "socials", "visibility", "onboarded"] as const;
      for (const k of allowed) if (patch[k] !== undefined) (p as unknown as Record<string, unknown>)[k] = patch[k];
      if (p.onboarded && !wasOnboarded) award(p.id, "profile_completed");
      for (const c of p.visited) if (!before.has(c)) award(p.id, "country_stamped", c);
      persist();
      return delay({ ...p });
    },
    handleAvailable: async (h) => delay(HANDLE_RE.test(h) && !db.profiles.some((p) => p.handle === h && p.id !== db.currentUserId)),
    async getProfile(uid) {
      const p = profile(uid);
      if (!p || (p.visibility === "private" && uid !== db.currentUserId && !isMod())) return delay(null);
      return delay({ ...p });
    },
    followCounts: async (uid) =>
      delay({ followers: db.follows.filter((f) => f.followeeId === uid).length, following: db.follows.filter((f) => f.followerId === uid).length }),
    async profileStats(uid) {
      if (!canView(uid)) return delay(null);
      return delay({
        followers: db.follows.filter((f) => f.followeeId === uid).length,
        following: db.follows.filter((f) => f.followerId === uid).length,
        gems: db.gems.filter((g) => g.authorId === uid && g.status === "published").length,
        posts: db.posts.filter((p) => p.authorId === uid && p.status === "published" && community(p.communityId)?.status === "published").length,
        communities: db.members.filter((m) => m.userId === uid && community(m.communityId)?.status === "published").length,
      });
    },
    async setAvatar(photo) {
      const p = profile(me())!;
      p.avatarUrl = photo ? await blobToDataUrl(photo) : null;
      persist();
      return delay({ ...p });
    },
    listFollowers: async (uid) => delay(db.follows.filter((f) => f.followeeId === uid && canView(f.followerId) && canView(uid)).map((f) => authorRef(f.followerId)).filter(Boolean) as AuthorRef[]),
    listFollowees: async (uid) => delay(db.follows.filter((f) => f.followerId === uid && canView(f.followeeId) && canView(uid)).map((f) => authorRef(f.followeeId)).filter(Boolean) as AuthorRef[]),

    listDestinations: async () => delay(DESTINATIONS),
    listGems: async () => delay(db.gems.filter(visibleGem).map(withAuthor)),
    getGem: async (gid) => {
      const g = db.gems.find((x) => x.id === gid);
      return delay(g && visibleGem(g) ? withAuthor(g) : null);
    },
    async createGem(input, photos) {
      const uid = me();
      if (countToday(db.gems, (g) => g.authorId === uid) >= DAILY_LIMITS.gems) throw new ApiError("dailyLimit");
      const urls = await Promise.all(photos.slice(0, 6).map(blobToDataUrl));
      if (input.sourcePostId) {
        const post = db.posts.find((p) => p.id === input.sourcePostId);
        if (!post || post.authorId !== uid || post.kind !== "recommendation") throw new ApiError("notYourRecommendation");
        if (db.gems.some((g) => g.sourcePostId === input.sourcePostId)) throw new ApiError("duplicate");
      }
      const gem: Gem = {
        ...input, id: id(), authorId: uid, author: null, photos: urls, upvotes: 0, saves: 0, reports: 0, createdAt: now(),
        // Recommendations from Community always wait for a moderator.
        status: input.sourcePostId || needsReview(`${input.name} ${input.description} ${input.tip}`) ? "pending" : "published",
      };
      db.gems.unshift(gem);
      if (gem.status === "published") award(uid, "gem_published", gem.id);
      persist();
      return delay(withAuthor(gem));
    },
    async deleteGem(gid) {
      const uid = me();
      const g = db.gems.find((x) => x.id === gid);
      if (!g || (g.authorId !== uid && !isMod())) throw new ApiError("permission");
      db.gems = db.gems.filter((x) => x.id !== gid);
      persist();
    },
    myUpvotes: async () => delay(db.currentUserId ? db.upvotes.filter((u) => u.userId === db.currentUserId).map((u) => u.gemId) : []),
    async setUpvote(gemId, on) {
      const uid = me();
      const g = db.gems.find((x) => x.id === gemId);
      if (!g) throw new ApiError("notFound");
      const has = db.upvotes.some((u) => u.gemId === gemId && u.userId === uid);
      if (on && !has) {
        if (g.authorId === uid) throw new ApiError("ownGem");
        db.upvotes.push({ gemId, userId: uid });
        g.upvotes++;
        award(g.authorId, "upvote_received", `${gemId}:${uid}`);
      } else if (!on && has) {
        db.upvotes = db.upvotes.filter((u) => !(u.gemId === gemId && u.userId === uid));
        g.upvotes = Math.max(0, g.upvotes - 1);
      }
      persist();
    },
    listEvents: async () => delay(db.events.filter((e) => !e.endsAt || new Date(e.endsAt).getTime() > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))),
    listTips: async (destId) =>
      delay(
        db.tips
          .filter((t) => t.destinationId === destId && ((t.status === "published" && !blockedByMe(t.authorId)) || t.authorId === db.currentUserId))
          .map(withAuthor)
          .sort((a, b) => b.votes - a.votes),
      ),
    async createTip(destinationId, category, body) {
      const uid = me();
      if (countToday(db.tips, (t) => t.authorId === uid) >= DAILY_LIMITS.tips) throw new ApiError("dailyLimit");
      if (body.trim().length < 10) throw new ApiError("noteTooShort");
      const tip: Tip = { id: id(), authorId: uid, author: null, destinationId, category, body, votes: 0, createdAt: now(), status: needsReview(body) ? "pending" : "published" };
      db.tips.unshift(tip);
      if (tip.status === "published") award(uid, "tip_published", tip.id);
      persist();
      return delay(withAuthor(tip));
    },
    async deleteTip(tid) {
      const uid = me();
      db.tips = db.tips.filter((t) => !(t.id === tid && (t.authorId === uid || isMod())));
      persist();
    },
    myTipVotes: async () => delay(db.currentUserId ? db.tipVotes.filter((v) => v.userId === db.currentUserId).map((v) => v.tipId) : []),
    async setTipVote(tipId, on) {
      const uid = me();
      const t = db.tips.find((x) => x.id === tipId);
      if (!t) return;
      const has = db.tipVotes.some((v) => v.tipId === tipId && v.userId === uid);
      if (on && !has) {
        if (t.authorId === uid) throw new ApiError("ownNote");
        db.tipVotes.push({ tipId, userId: uid });
        t.votes++;
      } else if (!on && has) {
        db.tipVotes = db.tipVotes.filter((v) => !(v.tipId === tipId && v.userId === uid));
        t.votes = Math.max(0, t.votes - 1);
      }
      persist();
    },

    listSaves: async () =>
      delay(db.currentUserId ? db.saves.filter((s) => s.userId === db.currentUserId).map(({ itemType, itemId, createdAt }) => ({ itemType, itemId, createdAt })) : []),
    async setSaved(itemType, itemId, on) {
      const uid = me();
      const has = db.saves.some((s) => s.userId === uid && s.itemType === itemType && s.itemId === itemId);
      if (on && !has) {
        db.saves.unshift({ userId: uid, itemType, itemId, createdAt: now() });
        const g = itemType === "gem" ? db.gems.find((x) => x.id === itemId) : undefined;
        if (g) g.saves++;
        award(uid, "saved", `${itemType}:${itemId}`);
      } else if (!on && has) {
        db.saves = db.saves.filter((s) => !(s.userId === uid && s.itemType === itemType && s.itemId === itemId));
        const g = itemType === "gem" ? db.gems.find((x) => x.id === itemId) : undefined;
        if (g) g.saves = Math.max(0, g.saves - 1);
      }
      persist();
    },

    listTrips: async () =>
      delay(db.currentUserId ? db.trips.filter((t) => t.userId === db.currentUserId).map(({ userId: _u, ...t }) => t).sort((a, b) => (a.startDate ?? "9").localeCompare(b.startDate ?? "9")) : []),
    async createTrip(t: NewTrip) {
      const uid = me();
      if (countToday(db.trips, (x) => x.userId === uid) >= DAILY_LIMITS.trips) throw new ApiError("dailyLimit");
      const trip: Owned<Trip> = { ...t, id: id(), userId: uid, notes: "", createdAt: now(), updatedAt: now() };
      db.trips.push(trip);
      award(uid, "trip_created", trip.id);
      persist();
      const { userId: _u, ...out } = trip;
      return delay(out);
    },
    async updateTrip(tid, patch) {
      const t = db.trips.find((x) => x.id === tid && x.userId === me());
      if (!t) throw new ApiError("notFound");
      Object.assign(t, patch, { updatedAt: now() });
      persist();
    },
    async deleteTrip(tid) {
      const uid = me();
      db.trips = db.trips.filter((t) => !(t.id === tid && t.userId === uid));
      db.items = db.items.filter((i) => i.tripId !== tid);
      persist();
    },
    async listTripItems(tid) {
      const uid = me();
      if (!db.trips.some((t) => t.id === tid && t.userId === uid)) return delay([]);
      return delay(db.items.filter((i) => i.tripId === tid).sort((a, b) => a.day - b.day || a.position - b.position));
    },
    async addTripItems(items) {
      const uid = me();
      for (const it of items) {
        if (!db.trips.some((t) => t.id === it.tripId && t.userId === uid)) throw new ApiError("permission");
        const position = it.position ?? db.items.filter((i) => i.tripId === it.tripId && i.day === it.day).length;
        db.items.push({ ...it, id: id(), position, done: false });
      }
      persist();
    },
    async updateTripItem(iid, patch) {
      const uid = me();
      const it = db.items.find((i) => i.id === iid);
      const trip = it && db.trips.find((t) => t.id === it.tripId && t.userId === uid);
      if (!it || !trip) throw new ApiError("notFound");
      const wasDone = it.done;
      Object.assign(it, patch);
      if (it.done && !wasDone) award(uid, "stop_done", it.id);
      persist();
    },
    async deleteTripItem(iid) {
      const uid = me();
      db.items = db.items.filter((i) => !(i.id === iid && db.trips.some((t) => t.id === i.tripId && t.userId === uid)));
      persist();
    },

    listFollowing: async () => delay(db.currentUserId ? db.follows.filter((f) => f.followerId === db.currentUserId).map((f) => f.followeeId) : []),
    async setFollow(uid2, on) {
      const uid = me();
      if (uid === uid2) throw new ApiError("followSelf");
      const target = profile(uid2);
      const has = db.follows.some((f) => f.followerId === uid && f.followeeId === uid2);
      if (on && !has) {
        if (!target || target.visibility === "private") throw new ApiError("privateProfile");
        if (db.blocks.some((b) => b.blockerId === uid2 && b.blockedId === uid)) throw new ApiError("permission");
        db.follows.push({ followerId: uid, followeeId: uid2 });
        award(uid, "followed", uid2);
      } else if (!on) db.follows = db.follows.filter((f) => !(f.followerId === uid && f.followeeId === uid2));
      persist();
    },
    listBlocks: async () => delay(db.currentUserId ? db.blocks.filter((b) => b.blockerId === db.currentUserId).map((b) => b.blockedId) : []),
    async setBlock(uid2, on) {
      const uid = me();
      db.blocks = db.blocks.filter((b) => !(b.blockerId === uid && b.blockedId === uid2));
      if (on) {
        db.blocks.push({ blockerId: uid, blockedId: uid2 });
        db.follows = db.follows.filter((f) => !(f.followerId === uid && f.followeeId === uid2));
      }
      persist();
    },
    async report(targetType, targetId, reason, details) {
      const uid = me();
      if (db.reports.some((r) => r.reporterId === uid && r.targetType === targetType && r.targetId === targetId)) throw new ApiError("alreadyReported");
      if (countToday(db.reports, (r) => r.reporterId === uid) >= DAILY_LIMITS.reports) throw new ApiError("dailyLimit");
      db.reports.push({ id: id(), reporterId: uid, targetType, targetId, reason, details, status: "open", createdAt: now() });
      const count = db.reports.filter((r) => r.targetType === targetType && r.targetId === targetId && r.status === "open").length;
      const hide = count >= REPORT_HIDE_THRESHOLD;
      if (targetType === "gem" || targetType === "tip") {
        const target = targetType === "gem" ? db.gems.find((g) => g.id === targetId) : db.tips.find((t) => t.id === targetId);
        if (target && "reports" in target) {
          target.reports++;
          if (target.reports >= REPORT_HIDE_THRESHOLD && target.status === "published") target.status = "hidden";
        }
      } else if (targetType === "post") {
        const p = db.posts.find((x) => x.id === targetId);
        if (p) {
          p.reports++;
          if (hide && p.status === "published") setPostStatus(p, "hidden");
        }
      } else if (targetType === "comment") {
        const c = db.comments.find((x) => x.id === targetId);
        if (c && hide && c.status === "published") setCommentStatus(c, "hidden");
      } else if (targetType === "community") {
        const c = community(targetId);
        if (c && hide && c.status === "published") c.status = "hidden";
      }
      persist();
    },

    // Communities ---------------------------------------------------------------------------
    listCommunities: async () => delay(db.communities.filter(visibleCommunity).sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name))),
    getCommunity: async (cid) => {
      const c = community(cid);
      return delay(c && visibleCommunity(c) ? c : null);
    },
    async createCommunity(input: NewCommunity) {
      const uid = me();
      if (countToday(db.communities.map((c) => ({ ...c, createdAt: c.createdAt })), (c) => c.createdBy === uid) >= DAILY_LIMITS.communities && !isMod()) throw new ApiError("dailyLimit");
      const name = input.name.trim();
      if (name.length < 3 || name.length > 60) throw new ApiError("invalid");
      if (db.communities.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new ApiError("communityNameTaken");
      let slug = slugify(name);
      while (db.communities.some((c) => c.slug === slug)) slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
      const c: Community = {
        ...input, name, description: input.description.trim(), id: id(), slug, official: false, createdBy: uid, memberCount: 1, postCount: 0, createdAt: now(),
        status: needsReview(`${name} ${input.description}`) ? "pending" : "published",
      };
      db.communities.unshift(c);
      db.members.push({ communityId: c.id, userId: uid, role: "owner", joinedAt: now() });
      award(uid, "community_created", c.id);
      persist();
      return delay(c);
    },
    async updateCommunity(cid, patch) {
      const c = community(cid);
      if (!c || !(isCommunityMod(cid) || isMod())) throw new ApiError("permission");
      if (patch.name && db.communities.some((x) => x.id !== cid && x.name.toLowerCase() === patch.name!.trim().toLowerCase())) throw new ApiError("communityNameTaken");
      Object.assign(c, patch);
      if ((patch.name !== undefined || patch.description !== undefined) && c.status === "published" && needsReview(`${c.name} ${c.description}`)) c.status = "pending";
      persist();
    },
    async deleteCommunity(cid) {
      if (!(roleIn(cid) === "owner" || isMod())) throw new ApiError("permission");
      const postIds = new Set(db.posts.filter((p) => p.communityId === cid).map((p) => p.id));
      db.communities = db.communities.filter((c) => c.id !== cid);
      db.members = db.members.filter((m) => m.communityId !== cid);
      db.posts = db.posts.filter((p) => !postIds.has(p.id));
      db.comments = db.comments.filter((c) => !postIds.has(c.postId));
      db.likes = db.likes.filter((l) => !postIds.has(l.postId));
      db.postSaves = db.postSaves.filter((l) => !postIds.has(l.postId));
      db.gems.forEach((g) => g.sourcePostId && postIds.has(g.sourcePostId) && (g.sourcePostId = null));
      persist();
    },
    myMemberships: async () => delay(db.currentUserId ? db.members.filter((m) => m.userId === db.currentUserId).map(({ communityId, role, joinedAt }) => ({ communityId, role, joinedAt })) : []),
    async setMembership(cid, on) {
      const uid = me();
      const role = roleIn(cid, uid);
      if (on && !role) {
        const c = community(cid);
        if (!c || c.status !== "published") throw new ApiError("notFound");
        if (countToday(db.members.map((m) => ({ ...m, createdAt: m.joinedAt })), (m) => m.userId === uid) >= DAILY_LIMITS.joins) throw new ApiError("dailyLimit");
        db.members.push({ communityId: cid, userId: uid, role: "member", joinedAt: now() });
        award(uid, "community_joined", cid);
      } else if (!on && role) {
        if (role === "owner") throw new ApiError("ownerCannotLeave");
        db.members = db.members.filter((m) => !(m.communityId === cid && m.userId === uid));
      }
      recount(cid);
      persist();
    },
    async listMembers(cid) {
      const rank = { owner: 0, moderator: 1, member: 2 } as const;
      const c = community(cid);
      if (!c || !visibleCommunity(c)) return delay([]);
      return delay(db.members.filter((m) => m.communityId === cid && (m.userId === db.currentUserId || canView(m.userId)))
        .map((m): Member | null => {
          const a = authorRef(m.userId);
          return a ? { ...a, role: m.role } : null;
        })
        .filter(Boolean)
        .sort((a, b) => rank[a!.role] - rank[b!.role]) as Member[]);
    },
    async setMemberRole(cid, uid2, role) {
      me();
      if (roleIn(cid) !== "owner" && !isMod()) throw new ApiError("ownerOnly");
      const m = db.members.find((x) => x.communityId === cid && x.userId === uid2 && x.role !== "owner");
      if (!m) throw new ApiError("notFound");
      m.role = role;
      persist();
    },
    async removeMember(cid, uid2) {
      me();
      const target = db.members.find((x) => x.communityId === cid && x.userId === uid2);
      const allowed = target && target.role !== "owner" && (isMod() || (target.role === "member" && isCommunityMod(cid)) || (target.role === "moderator" && roleIn(cid) === "owner"));
      if (!allowed) throw new ApiError("permission");
      db.members = db.members.filter((m) => m !== target);
      recount(cid);
      persist();
    },
    communitiesOf: async (uid) => {
      if (uid !== db.currentUserId && !canView(uid)) return delay([]);
      return delay(db.members.filter((m) => m.userId === uid).map((m) => community(m.communityId)).filter((c): c is Community => !!c && visibleCommunity(c)));
    },

    // Posts -------------------------------------------------------------------------------------
    async listPosts(f) {
      let rows = db.posts.filter(visiblePost);
      if (f.communityId) rows = rows.filter((p) => p.communityId === f.communityId);
      if (f.communityIds) rows = rows.filter((p) => f.communityIds!.includes(p.communityId));
      if (f.authorId) rows = rows.filter((p) => p.authorId === f.authorId);
      if (f.destinationId) rows = rows.filter((p) => p.destinationId === f.destinationId);
      if (f.ids) rows = rows.filter((p) => f.ids!.includes(p.id));
      return delay(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, f.limit ?? 50).map(postOut));
    },
    getPost: async (pid) => {
      const p = db.posts.find((x) => x.id === pid);
      return delay(p && visiblePost(p) ? postOut(p) : null);
    },
    async createPost(input, photos) {
      const uid = me();
      const c = community(input.communityId);
      if (!c || c.status !== "published" || !roleIn(c.id, uid)) throw new ApiError("joinFirst");
      if (countToday(db.posts, (p) => p.authorId === uid) >= DAILY_LIMITS.posts && !isMod()) throw new ApiError("dailyLimit");
      if (input.title.trim().length < 3 || !input.body.trim()) throw new ApiError("invalid");
      const urls = await Promise.all(photos.slice(0, 6).map(blobToDataUrl));
      const post: Post = {
        ...input, title: input.title.trim(), body: input.body.trim(), place: input.place.trim(), id: id(), community: null, authorId: uid, author: null,
        photos: urls, status: "pending", likes: 0, comments: 0, saves: 0, reports: 0, createdAt: now(), editedAt: null,
      };
      db.posts.unshift(post);
      setPostStatus(post, needsReview(`${post.title} ${post.body} ${post.place}`) ? "pending" : "published");
      persist();
      return delay(postOut(post));
    },
    async updatePost(pid, patch) {
      const p = db.posts.find((x) => x.id === pid);
      if (!p || p.authorId !== me()) throw new ApiError("permission");
      Object.assign(p, patch, { editedAt: now() });
      if (p.status === "published" && needsReview(`${p.title} ${p.body} ${p.place}`)) setPostStatus(p, "pending");
      persist();
    },
    async deletePost(pid) {
      const uid = me();
      const p = db.posts.find((x) => x.id === pid);
      if (!p || !(p.authorId === uid || isMod() || isCommunityMod(p.communityId))) throw new ApiError("permission");
      db.posts = db.posts.filter((x) => x.id !== pid);
      db.comments = db.comments.filter((c) => c.postId !== pid);
      db.likes = db.likes.filter((l) => l.postId !== pid);
      db.postSaves = db.postSaves.filter((l) => l.postId !== pid);
      db.gems.forEach((g) => g.sourcePostId === pid && (g.sourcePostId = null));
      recount(p.communityId);
      persist();
    },
    myLikes: async () => delay(db.currentUserId ? db.likes.filter((l) => l.userId === db.currentUserId).map((l) => l.postId) : []),
    async setLike(pid, on) {
      const uid = me();
      const p = db.posts.find((x) => x.id === pid);
      if (!p || !visiblePost(p)) throw new ApiError("notFound");
      const has = db.likes.some((l) => l.postId === pid && l.userId === uid);
      if (on && !has) {
        if (p.authorId === uid) throw new ApiError("ownPost");
        if (p.status !== "published") throw new ApiError("permission");
        db.likes.push({ postId: pid, userId: uid, createdAt: now() });
        p.likes++;
        award(p.authorId, "like_received", `${pid}:${uid}`);
      } else if (!on && has) {
        db.likes = db.likes.filter((l) => !(l.postId === pid && l.userId === uid));
        p.likes = Math.max(0, p.likes - 1);
      }
      persist();
    },
    mySavedPosts: async () =>
      delay(db.currentUserId ? db.postSaves.filter((l) => l.userId === db.currentUserId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((l) => l.postId) : []),
    async setPostSaved(pid, on) {
      const uid = me();
      const p = db.posts.find((x) => x.id === pid);
      const has = db.postSaves.some((l) => l.postId === pid && l.userId === uid);
      if (on && !has) {
        if (!p || !visiblePost(p)) throw new ApiError("notFound");
        db.postSaves.push({ postId: pid, userId: uid, createdAt: now() });
        p.saves++;
      } else if (!on && has) {
        db.postSaves = db.postSaves.filter((l) => !(l.postId === pid && l.userId === uid));
        if (p) p.saves = Math.max(0, p.saves - 1);
      }
      persist();
    },
    listComments: async (pid) => delay(db.comments.filter((c) => c.postId === pid && visibleComment(c)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(withAuthor)),
    async createComment(pid, body) {
      const uid = me();
      const p = db.posts.find((x) => x.id === pid);
      if (!p || p.status !== "published" || !visiblePost(p)) throw new ApiError("notFound");
      if (!roleIn(p.communityId, uid)) throw new ApiError("joinFirst");
      if (countToday(db.comments, (c) => c.authorId === uid) >= DAILY_LIMITS.comments && !isMod()) throw new ApiError("dailyLimit");
      if (!body.trim()) throw new ApiError("invalid");
      const c: Comment = { id: id(), postId: pid, authorId: uid, author: null, body: body.trim(), status: "pending", createdAt: now(), editedAt: null };
      db.comments.push(c);
      setCommentStatus(c, needsReview(c.body) ? "pending" : "published");
      if (c.status === "published") award(uid, "comment_published", c.id);
      persist();
      return delay(withAuthor(c));
    },
    async updateComment(cid, body) {
      const c = db.comments.find((x) => x.id === cid);
      if (!c || c.authorId !== me()) throw new ApiError("permission");
      c.body = body.trim();
      c.editedAt = now();
      if (c.status === "published" && needsReview(c.body)) setCommentStatus(c, "pending");
      persist();
    },
    async deleteComment(cid) {
      const uid = me();
      const c = db.comments.find((x) => x.id === cid);
      const post = c && db.posts.find((p) => p.id === c.postId);
      if (!c || !(c.authorId === uid || isMod() || (post && isCommunityMod(post.communityId)))) throw new ApiError("permission");
      if (c.status === "published") setCommentStatus(c, "rejected");
      db.comments = db.comments.filter((x) => x.id !== cid);
      persist();
    },
    gemFromPost: async (pid) => {
      const g = db.gems.find((x) => x.sourcePostId === pid);
      return delay(g && visibleGem(g) ? withAuthor(g) : null);
    },

    xpHistory: async () => delay(db.xp.filter((x) => x.userId === db.currentUserId).map(({ userId: _u, ...x }) => x)),

    async moderationQueue(): Promise<ModerationQueue> {
      if (!isMod()) throw new ApiError("moderatorsOnly");
      return delay({
        gems: db.gems.filter((g) => g.status === "pending" || g.status === "hidden").map(withAuthor),
        tips: db.tips.filter((t) => t.status === "pending" || t.status === "hidden").map(withAuthor),
        posts: db.posts.filter((p) => p.status === "pending" || p.status === "hidden").map(postOut),
        comments: db.comments.filter((c) => c.status === "pending" || c.status === "hidden").map(withAuthor),
        communities: db.communities.filter((c) => c.status === "pending" || c.status === "hidden"),
        reports: db.reports.filter((r) => r.status === "open"),
      });
    },
    async moderate(targetType, tid, status: ContentStatus) {
      const closeReports = () => {
        for (const r of db.reports) {
          if (r.targetType === targetType && r.targetId === tid && r.status === "open") r.status = status === "published" ? "dismissed" : "resolved";
        }
      };
      if (targetType === "post" || targetType === "comment" || targetType === "community") {
        if (targetType === "community") {
          const c = community(tid);
          if (!isMod()) throw new ApiError("moderatorsOnly");
          if (!c) throw new ApiError("notFound");
          c.status = status;
        } else if (targetType === "post") {
          const p = db.posts.find((x) => x.id === tid);
          if (!p) throw new ApiError("notFound");
          if (!isMod() && !isCommunityMod(p.communityId)) throw new ApiError("moderatorsOnly");
          setPostStatus(p, status);
          if (status === "published") p.reports = 0;
        } else {
          const c = db.comments.find((x) => x.id === tid);
          const post = c && db.posts.find((p) => p.id === c.postId);
          if (!c || !post) throw new ApiError("notFound");
          if (!isMod() && !isCommunityMod(post.communityId)) throw new ApiError("moderatorsOnly");
          setCommentStatus(c, status);
        }
        closeReports();
        persist();
        return;
      }
      if (!isMod()) throw new ApiError("moderatorsOnly");
      const target = targetType === "gem" ? db.gems.find((g) => g.id === tid) : db.tips.find((t) => t.id === tid);
      if (!target) throw new ApiError("notFound");
      const was = target.status;
      target.status = status;
      if (status === "published") {
        if ("reports" in target) target.reports = 0;
        if (was !== "published") award(target.authorId, targetType === "gem" ? "gem_published" : "tip_published", tid);
      }
      for (const r of db.reports) {
        if (r.targetType === targetType && r.targetId === tid && r.status === "open") r.status = status === "published" ? "dismissed" : "resolved";
      }
      persist();
    },
    async resolveReport(rid, status) {
      if (!isMod()) throw new ApiError("moderatorsOnly");
      const r = db.reports.find((x) => x.id === rid);
      if (r) r.status = status;
      persist();
    },
  };
  return api;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new ApiError("photoRead"));
    r.readAsDataURL(b);
  });
}

/** Test helper: wipe demo data. */
export function resetLocalDb() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
