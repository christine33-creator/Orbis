import type { Api, ModerationQueue, NewTrip } from "./types";
import { ApiError } from "./types";
import type {
  AuthUser, ContentStatus, Gem, ItemType, Profile, PulseEvent, Report, Tip, Trip, TripItem, XpEvent,
} from "../types";
import { DESTINATIONS } from "../data/destinations";
import { GEM_SEEDS } from "../data/gems";
import { EVENT_SEEDS } from "../data/events";
import { DEMO_PEOPLE, DEMO_TIPS } from "../data/demo";
import { DAILY_LIMITS, HANDLE_RE, REPORT_HIDE_THRESHOLD, XP_AWARDS, needsReview, type XpReason } from "../lib/rules";

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
}

const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const dayAgo = () => Date.now() - 86400000;

function baseProfile(p: Partial<Profile> & Pick<Profile, "id" | "handle">): Profile {
  return {
    name: "", home: "", bio: "", hue: 20, styles: [], visited: [], watching: [], socials: {},
    preferences: { pace: "balanced", budget: "comfort", company: "solo" }, visibility: "public",
    onboarded: true, role: "member", xp: 0, createdAt: now(), ...p,
  };
}

function seed(): Db {
  const team = baseProfile({ id: TEAM_ID, handle: "orbis_team", name: "Orbis Team", hue: 12, bio: "Starter picks from the Orbis editors." });
  const people = DEMO_PEOPLE.map((p) => baseProfile({ ...p, xp: 400 + p.name.length * 90 }));
  const authorRef = (p: Profile) => ({ id: p.id, handle: p.handle, name: p.name, hue: p.hue });
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
  return {
    version: 1, currentUserId: null, users: [], profiles: [team, ...people], gems, upvotes: [], tips, tipVotes: [],
    events, saves: [], trips: [], items: [], follows: [], blocks: [], reports: [], xp: [],
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Db;
      if (db.version === 1) return db;
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
      throw new ApiError("This device is out of storage for the demo. Remove some photos and try again.");
    }
  };
  // Return copies, like a network API would; handing out internal objects breaks change detection.
  const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 60));
  const me = () => {
    const uid = db.currentUserId;
    if (!uid) throw new ApiError("Please sign in first.");
    return uid;
  };
  const profile = (uid: string) => db.profiles.find((p) => p.id === uid);
  const isMod = () => {
    const p = db.currentUserId ? profile(db.currentUserId) : undefined;
    return p?.role === "moderator" || p?.role === "admin";
  };
  const blockedByMe = (author: string) => db.blocks.some((b) => b.blockerId === db.currentUserId && b.blockedId === author);
  const authorRef = (uid: string) => {
    const p = profile(uid);
    if (!p || (p.visibility === "private" && uid !== db.currentUserId)) return null;
    return { id: p.id, handle: p.handle, name: p.name, hue: p.hue };
  };
  const countToday = <T extends { createdAt: string }>(rows: T[], owned: (r: T) => boolean) =>
    rows.filter((r) => owned(r) && new Date(r.createdAt).getTime() > dayAgo()).length;

  function award(uid: string, reason: XpReason, ref = "") {
    if (db.xp.some((x) => x.userId === uid && x.reason === reason && x.ref === ref)) return;
    const amount = XP_AWARDS[reason];
    db.xp.unshift({ id: id(), userId: uid, amount, reason, ref, createdAt: now() });
    const p = profile(uid);
    if (p) p.xp += amount;
  }

  function visibleGem(g: Gem) {
    return (g.status === "published" && !blockedByMe(g.authorId)) || g.authorId === db.currentUserId || isMod();
  }
  const withAuthor = <T extends { authorId: string }>(row: T) => ({ ...row, author: authorRef(row.authorId) });

  const setUser = (u: AuthUser | null) => {
    db.currentUserId = u?.id ?? null;
    persist();
    listeners.forEach((l) => l(u));
  };

  function signIn(email: string) {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new ApiError("Enter a valid email address.");
    let user = db.users.find((u) => u.email === clean);
    if (!user) {
      user = { id: id(), email: clean };
      db.users.push(user);
      // In the demo, every account can open the moderation queue so it can be tried out.
      db.profiles.push(baseProfile({ id: user.id, handle: `explorer_${user.id.replace(/-/g, "").slice(0, 8)}`, onboarded: false, role: "moderator", hue: Math.floor(Math.random() * 360) }));
    }
    setUser(user);
  }

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
      setUser(null);
    },

    getMyProfile: async () => delay(db.currentUserId ? (profile(db.currentUserId) ?? null) : null),
    async updateMyProfile(patch) {
      const p = profile(me())!;
      if (patch.handle !== undefined) {
        if (!HANDLE_RE.test(patch.handle)) throw new ApiError("Handles use 3–30 lowercase letters, numbers, dots or underscores.");
        if (db.profiles.some((x) => x.handle === patch.handle && x.id !== p.id)) throw new ApiError("That handle is taken.");
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

    listDestinations: async () => delay(DESTINATIONS),
    listGems: async () => delay(db.gems.filter(visibleGem).map(withAuthor)),
    getGem: async (gid) => {
      const g = db.gems.find((x) => x.id === gid);
      return delay(g && visibleGem(g) ? withAuthor(g) : null);
    },
    async createGem(input, photos) {
      const uid = me();
      if (countToday(db.gems, (g) => g.authorId === uid) >= DAILY_LIMITS.gems) throw new ApiError("Daily limit reached. Please try again tomorrow.");
      const urls = await Promise.all(photos.slice(0, 6).map(blobToDataUrl));
      const gem: Gem = {
        ...input, id: id(), authorId: uid, author: null, photos: urls, upvotes: 0, saves: 0, reports: 0, createdAt: now(),
        status: needsReview(`${input.name} ${input.description} ${input.tip}`) ? "pending" : "published",
      };
      db.gems.unshift(gem);
      if (gem.status === "published") award(uid, "gem_published", gem.id);
      persist();
      return delay(withAuthor(gem));
    },
    async deleteGem(gid) {
      const uid = me();
      const g = db.gems.find((x) => x.id === gid);
      if (!g || (g.authorId !== uid && !isMod())) throw new ApiError("You don't have permission to do that.");
      db.gems = db.gems.filter((x) => x.id !== gid);
      persist();
    },
    myUpvotes: async () => delay(db.currentUserId ? db.upvotes.filter((u) => u.userId === db.currentUserId).map((u) => u.gemId) : []),
    async setUpvote(gemId, on) {
      const uid = me();
      const g = db.gems.find((x) => x.id === gemId);
      if (!g) throw new ApiError("That gem is no longer available.");
      const has = db.upvotes.some((u) => u.gemId === gemId && u.userId === uid);
      if (on && !has) {
        if (g.authorId === uid) throw new ApiError("You cannot upvote your own gem.");
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
      if (countToday(db.tips, (t) => t.authorId === uid) >= DAILY_LIMITS.tips) throw new ApiError("Daily limit reached. Please try again tomorrow.");
      if (body.trim().length < 10) throw new ApiError("Notes need at least 10 characters.");
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
        if (t.authorId === uid) throw new ApiError("You cannot vote for your own note.");
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
      if (countToday(db.trips, (x) => x.userId === uid) >= DAILY_LIMITS.trips) throw new ApiError("Daily limit reached. Please try again tomorrow.");
      const trip: Owned<Trip> = { ...t, id: id(), userId: uid, notes: "", createdAt: now(), updatedAt: now() };
      db.trips.push(trip);
      award(uid, "trip_created", trip.id);
      persist();
      const { userId: _u, ...out } = trip;
      return delay(out);
    },
    async updateTrip(tid, patch) {
      const t = db.trips.find((x) => x.id === tid && x.userId === me());
      if (!t) throw new ApiError("Trip not found.");
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
        if (!db.trips.some((t) => t.id === it.tripId && t.userId === uid)) throw new ApiError("You don't have permission to do that.");
        const position = it.position ?? db.items.filter((i) => i.tripId === it.tripId && i.day === it.day).length;
        db.items.push({ ...it, id: id(), position, done: false });
      }
      persist();
    },
    async updateTripItem(iid, patch) {
      const uid = me();
      const it = db.items.find((i) => i.id === iid);
      const trip = it && db.trips.find((t) => t.id === it.tripId && t.userId === uid);
      if (!it || !trip) throw new ApiError("Stop not found.");
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
      if (uid === uid2) throw new ApiError("You can't follow yourself.");
      const target = profile(uid2);
      const has = db.follows.some((f) => f.followerId === uid && f.followeeId === uid2);
      if (on && !has) {
        if (!target || target.visibility === "private") throw new ApiError("This profile is private.");
        if (db.blocks.some((b) => b.blockerId === uid2 && b.blockedId === uid)) throw new ApiError("You don't have permission to do that.");
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
      if (db.reports.some((r) => r.reporterId === uid && r.targetType === targetType && r.targetId === targetId)) throw new ApiError("You've already reported this.");
      if (countToday(db.reports, (r) => r.reporterId === uid) >= DAILY_LIMITS.reports) throw new ApiError("Daily limit reached. Please try again tomorrow.");
      db.reports.push({ id: id(), reporterId: uid, targetType, targetId, reason, details, status: "open", createdAt: now() });
      const target = targetType === "gem" ? db.gems.find((g) => g.id === targetId) : targetType === "tip" ? db.tips.find((t) => t.id === targetId) : undefined;
      if (target && "reports" in target) {
        target.reports++;
        if (target.reports >= REPORT_HIDE_THRESHOLD && target.status === "published") target.status = "hidden";
      }
      persist();
    },

    xpHistory: async () => delay(db.xp.filter((x) => x.userId === db.currentUserId).map(({ userId: _u, ...x }) => x)),

    async moderationQueue(): Promise<ModerationQueue> {
      if (!isMod()) throw new ApiError("Only moderators can do this.");
      return delay({
        gems: db.gems.filter((g) => g.status === "pending" || g.status === "hidden").map(withAuthor),
        tips: db.tips.filter((t) => t.status === "pending" || t.status === "hidden").map(withAuthor),
        reports: db.reports.filter((r) => r.status === "open"),
      });
    },
    async moderate(targetType, tid, status: ContentStatus) {
      if (!isMod()) throw new ApiError("Only moderators can do this.");
      const target = targetType === "gem" ? db.gems.find((g) => g.id === tid) : db.tips.find((t) => t.id === tid);
      if (!target) throw new ApiError("That item no longer exists.");
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
      if (!isMod()) throw new ApiError("Only moderators can do this.");
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
    r.onerror = () => reject(new ApiError("A photo couldn't be read."));
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
