import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Api, NewTrip } from "./types";
import { ApiError, type ErrorCode } from "./types";
import type {
  AuthorRef, Destination, Gem, Profile, PulseEvent, Report, Tip, Trip, TripItem, XpEvent,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const GEM_SELECT = "*, author:profiles!gems_author_id_fkey(id, handle, name, hue)";
const TIP_SELECT = "*, author:profiles!tips_author_id_fkey(id, handle, name, hue)";

const toAuthor = (r: Row | null): AuthorRef | null => (r ? { id: r.id, handle: r.handle, name: r.name, hue: r.hue } : null);

const toProfile = (r: Row): Profile => ({
  id: r.id, handle: r.handle, name: r.name, home: r.home, bio: r.bio, hue: r.hue, styles: r.styles ?? [],
  preferences: { pace: "balanced", budget: "comfort", company: "solo", ...(r.preferences ?? {}) },
  visited: r.visited ?? [], watching: r.watching ?? [], socials: r.socials ?? {}, visibility: r.visibility,
  onboarded: r.onboarded, role: r.role, xp: r.xp, createdAt: r.created_at,
});

const toDestination = (r: Row): Destination => ({
  id: r.id, name: r.name, country: r.country, region: r.region, lat: r.lat, lng: r.lng, hiddenGem: r.hidden_gem,
  popularity: r.popularity, styles: r.styles ?? [], tagline: r.tagline, description: r.description, bestTime: r.best_time,
  scene: r.scene,
});

const toGem = (r: Row): Gem => ({
  id: r.id, authorId: r.author_id, author: toAuthor(r.author), destinationId: r.destination_id, name: r.name,
  description: r.description, tip: r.tip, category: r.category, styles: r.styles ?? [], lat: r.lat, lng: r.lng,
  country: r.country, photos: r.photos ?? [], status: r.status, upvotes: r.upvote_count, saves: r.save_count,
  reports: r.report_count, createdAt: r.created_at,
});

const toEvent = (r: Row): PulseEvent => ({
  id: r.id, destinationId: r.destination_id, city: r.city, category: r.category, title: r.title, summary: r.summary,
  startsAt: r.starts_at, endsAt: r.ends_at, url: r.url, imageUrl: r.image_url, lat: r.lat, lng: r.lng, source: r.source,
});

const toTip = (r: Row): Tip => ({
  id: r.id, authorId: r.author_id, author: toAuthor(r.author), destinationId: r.destination_id, category: r.category,
  body: r.body, status: r.status, votes: r.vote_count, createdAt: r.created_at,
});

const toTrip = (r: Row): Trip => ({
  id: r.id, destinationId: r.destination_id, title: r.title, style: r.style, startDate: r.start_date, days: r.days,
  notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
});

const toItem = (r: Row): TripItem => ({
  id: r.id, tripId: r.trip_id, day: r.day, position: r.position, time: r.time, title: r.title, notes: r.notes,
  itemType: r.item_type, itemId: r.item_id, done: r.done,
});

const toReport = (r: Row): Report => ({
  id: r.id, reporterId: r.reporter_id, targetType: r.target_type, targetId: r.target_id, reason: r.reason,
  details: r.details, status: r.status, createdAt: r.created_at,
});

/** Messages our database triggers raise on purpose (code P0001), mapped to error codes. */
const RAISED: [RegExp, ErrorCode][] = [
  [/daily limit/i, "dailyLimit"],
  [/own gem/i, "ownGem"],
  [/own note/i, "ownNote"],
  [/too many stops/i, "tooManyStops"],
  [/only moderators/i, "moderatorsOnly"],
];

/** Turns Postgres/PostgREST errors into codes the UI can translate. */
function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const { message, code } = res.error;
    if (code === "P0001") throw new ApiError(RAISED.find(([re]) => re.test(message))?.[1] ?? "generic");
    if (code === "23505") throw new ApiError("duplicate");
    if (code === "42501" || /row-level security/i.test(message)) throw new ApiError("permission");
    if (code === "23514") throw new ApiError("invalid");
    throw new ApiError("generic");
  }
  return res.data as T;
}

const authError = (message: string) =>
  message === "Invalid login credentials" ? new ApiError("badCredentials") : new ApiError("authFailed", { message });

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient<any, "public", any> = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const uid = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new ApiError("signInFirst");
    return id;
  };

  const redirectTo = () => window.location.origin + window.location.pathname;

  const api: Api = {
    mode: "supabase",

    async getUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? null } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) =>
        cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null),
      );
      return () => data.subscription.unsubscribe();
    },
    async sendMagicLink(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
      if (error) throw authError(error.message);
    },
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw authError(error.message);
    },
    async signUpWithPassword(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
      if (error) throw authError(error.message);
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
      if (error) throw authError(error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async deleteAccount() {
      check(await sb.rpc("delete_my_account"));
      await sb.auth.signOut();
    },

    async getMyProfile() {
      const { data } = await sb.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return null;
      const row = check(await sb.from("profiles").select("*").eq("id", id).maybeSingle());
      return row ? toProfile(row) : null;
    },
    async updateMyProfile(patch) {
      const id = await uid();
      const row: Row = {};
      for (const [k, v] of Object.entries(patch)) row[k] = v;
      return toProfile(check(await sb.from("profiles").update(row).eq("id", id).select("*").single()));
    },
    async handleAvailable(handle) {
      return check(await sb.rpc("handle_available", { candidate: handle })) as boolean;
    },
    async getProfile(id) {
      const row = check(await sb.from("profiles").select("*").eq("id", id).maybeSingle());
      return row ? toProfile(row) : null;
    },
    async followCounts(userId) {
      const [a, b] = await Promise.all([
        sb.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", userId),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      return { followers: a.count ?? 0, following: b.count ?? 0 };
    },

    async listDestinations() {
      return check(await sb.from("destinations").select("*").order("name")).map(toDestination);
    },
    async listGems() {
      const rows = check(await sb.from("gems").select(GEM_SELECT).order("created_at", { ascending: false }).limit(1000));
      return rows.map(toGem);
    },
    async getGem(id) {
      const row = check(await sb.from("gems").select(GEM_SELECT).eq("id", id).maybeSingle());
      return row ? toGem(row) : null;
    },
    async createGem(gem, photos) {
      const id = await uid();
      const urls: string[] = [];
      for (const blob of photos.slice(0, 6)) {
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from("gem-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new ApiError("photoUpload");
        urls.push(sb.storage.from("gem-photos").getPublicUrl(path).data.publicUrl);
      }
      const row = check<Row>(
        await sb.from("gems").insert({
          destination_id: gem.destinationId, name: gem.name, description: gem.description, tip: gem.tip,
          category: gem.category, styles: gem.styles, lat: gem.lat, lng: gem.lng, country: gem.country, photos: urls,
        }).select(GEM_SELECT).single(),
      );
      return toGem(row);
    },
    async deleteGem(id) {
      check(await sb.from("gems").delete().eq("id", id));
    },
    async myUpvotes() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("gem_upvotes").select("gem_id")).map((r: Row) => r.gem_id);
    },
    async setUpvote(gemId, on) {
      if (on) check(await sb.from("gem_upvotes").insert({ gem_id: gemId }));
      else check(await sb.from("gem_upvotes").delete().eq("gem_id", gemId).eq("user_id", await uid()));
    },
    async listEvents() {
      const now = new Date().toISOString();
      const rows = check(await sb.from("events").select("*").or(`ends_at.is.null,ends_at.gte.${now}`).order("starts_at").limit(200));
      return rows.map(toEvent);
    },
    async listTips(destinationId) {
      const rows = check(await sb.from("tips").select(TIP_SELECT).eq("destination_id", destinationId).order("vote_count", { ascending: false }));
      return rows.map(toTip);
    },
    async createTip(destinationId, category, body) {
      return toTip(check(await sb.from("tips").insert({ destination_id: destinationId, category, body }).select(TIP_SELECT).single()));
    },
    async deleteTip(id) {
      check(await sb.from("tips").delete().eq("id", id));
    },
    async myTipVotes() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("tip_votes").select("tip_id")).map((r: Row) => r.tip_id);
    },
    async setTipVote(tipId, on) {
      if (on) check(await sb.from("tip_votes").insert({ tip_id: tipId }));
      else check(await sb.from("tip_votes").delete().eq("tip_id", tipId).eq("user_id", await uid()));
    },

    async listSaves() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("saves").select("*").order("created_at", { ascending: false })).map((r: Row) => ({
        itemType: r.item_type, itemId: r.item_id, createdAt: r.created_at,
      }));
    },
    async setSaved(itemType, itemId, on) {
      if (on) check(await sb.from("saves").upsert({ item_type: itemType, item_id: itemId }, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true }));
      else check(await sb.from("saves").delete().match({ user_id: await uid(), item_type: itemType, item_id: itemId }));
    },

    async listTrips() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("trips").select("*").order("start_date", { ascending: true, nullsFirst: false })).map(toTrip);
    },
    async createTrip(t: NewTrip) {
      return toTrip(check(await sb.from("trips").insert({
        destination_id: t.destinationId, title: t.title, style: t.style, start_date: t.startDate, days: t.days,
      }).select("*").single()));
    },
    async updateTrip(id, p) {
      const row: Row = {};
      if (p.title !== undefined) row.title = p.title;
      if (p.style !== undefined) row.style = p.style;
      if (p.startDate !== undefined) row.start_date = p.startDate;
      if (p.days !== undefined) row.days = p.days;
      if (p.destinationId !== undefined) row.destination_id = p.destinationId;
      if (p.notes !== undefined) row.notes = p.notes;
      check(await sb.from("trips").update(row).eq("id", id));
    },
    async deleteTrip(id) {
      check(await sb.from("trips").delete().eq("id", id));
    },
    async listTripItems(tripId) {
      return check(await sb.from("trip_items").select("*").eq("trip_id", tripId).order("day").order("position")).map(toItem);
    },
    async addTripItems(items) {
      if (!items.length) return;
      check(await sb.from("trip_items").insert(items.map((i) => ({
        trip_id: i.tripId, day: i.day, position: i.position ?? 0, time: i.time, title: i.title, notes: i.notes,
        item_type: i.itemType, item_id: i.itemId,
      }))));
    },
    async updateTripItem(id, p) {
      check(await sb.from("trip_items").update(p).eq("id", id));
    },
    async deleteTripItem(id) {
      check(await sb.from("trip_items").delete().eq("id", id));
    },

    async listFollowing() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("follows").select("followee_id").eq("follower_id", data.session.user.id)).map((r: Row) => r.followee_id);
    },
    async setFollow(userId, on) {
      if (on) check(await sb.from("follows").insert({ followee_id: userId }));
      else check(await sb.from("follows").delete().match({ follower_id: await uid(), followee_id: userId }));
    },
    async listBlocks() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("blocks").select("blocked_id")).map((r: Row) => r.blocked_id);
    },
    async setBlock(userId, on) {
      if (on) {
        check(await sb.from("blocks").insert({ blocked_id: userId }));
        await sb.from("follows").delete().match({ follower_id: await uid(), followee_id: userId });
      } else check(await sb.from("blocks").delete().match({ blocker_id: await uid(), blocked_id: userId }));
    },
    async report(targetType, targetId, reason, details) {
      check(await sb.from("reports").insert({ target_type: targetType, target_id: targetId, reason, details }));
    },

    async xpHistory() {
      const rows = check(await sb.from("xp_events").select("*").order("created_at", { ascending: false }).limit(100));
      return rows.map((r: Row): XpEvent => ({ id: String(r.id), amount: r.amount, reason: r.reason, ref: r.ref, createdAt: r.created_at }));
    },

    async moderationQueue() {
      const [gems, tips, reports] = await Promise.all([
        sb.from("gems").select(GEM_SELECT).in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("tips").select(TIP_SELECT).in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("reports").select("*").eq("status", "open").order("created_at"),
      ]);
      return { gems: check(gems).map(toGem), tips: check(tips).map(toTip), reports: check(reports).map(toReport) };
    },
    async moderate(targetType, id, status, note) {
      check(await sb.rpc("moderate", { target_type: targetType, target_id: id, new_status: status, note }));
    },
    async resolveReport(id, status) {
      check(await sb.rpc("resolve_report", { report_id: id, new_status: status }));
    },
  };
  return api;
}
