import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Api, NewTrip } from "./types";
import { ApiError, type ErrorCode } from "./types";
import type {
  AuthorRef, Comment, Community, Destination, Gem, Member, NewCommunity, Post, Profile, PulseEvent, Report, Tip, Trip, TripItem, XpEvent,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/** Public profile columns. Private settings are read only through get_my_profile(). */
const PROFILE_COLS = "id, handle, name, home, bio, hue, avatar_url, styles, visited, socials, visibility, role, xp, created_at";
const AUTHOR_COLS = "id, handle, name, hue, avatar_url";
const GEM_SELECT = `*, author:profiles!gems_author_id_fkey(${AUTHOR_COLS})`;
const TIP_SELECT = `*, author:profiles!tips_author_id_fkey(${AUTHOR_COLS})`;
const POST_SELECT = `*, author:profiles!community_posts_author_id_fkey(${AUTHOR_COLS}), community:communities(id, name, hue), media:post_media(url, position)`;
const COMMENT_SELECT = `*, author:profiles!post_comments_author_id_fkey(${AUTHOR_COLS})`;

const toAuthor = (r: Row | null): AuthorRef | null =>
  r ? { id: r.id, handle: r.handle, name: r.name, hue: r.hue, avatarUrl: r.avatar_url ?? null } : null;

const toCommunity = (r: Row): Community => ({
  id: r.id, slug: r.slug, name: r.name, description: r.description, category: r.category, destinationId: r.destination_id,
  country: r.country, styles: r.styles ?? [], hue: r.hue, official: r.official, createdBy: r.created_by, status: r.status,
  memberCount: r.member_count, postCount: r.post_count, createdAt: r.created_at,
});

const toPost = (r: Row): Post => ({
  id: r.id, communityId: r.community_id, community: r.community ? { id: r.community.id, name: r.community.name, hue: r.community.hue } : null,
  authorId: r.author_id, author: toAuthor(r.author), kind: r.kind, title: r.title, body: r.body, destinationId: r.destination_id,
  place: r.place, photos: [...(r.media ?? [])].sort((a: Row, b: Row) => a.position - b.position).map((m: Row) => m.url),
  status: r.status, likes: r.like_count, comments: r.comment_count, saves: r.save_count, reports: r.report_count,
  createdAt: r.created_at, editedAt: r.edited_at,
});

const toComment = (r: Row): Comment => ({
  id: r.id, postId: r.post_id, authorId: r.author_id, author: toAuthor(r.author), body: r.body, status: r.status,
  createdAt: r.created_at, editedAt: r.edited_at,
});

const communityRow = (c: Partial<NewCommunity>) => {
  const row: Row = {};
  if (c.name !== undefined) row.name = c.name.trim();
  if (c.description !== undefined) row.description = c.description.trim();
  if (c.category !== undefined) row.category = c.category;
  if (c.destinationId !== undefined) row.destination_id = c.destinationId;
  if (c.country !== undefined) row.country = c.country;
  if (c.styles !== undefined) row.styles = c.styles;
  if (c.hue !== undefined) row.hue = c.hue;
  return row;
};

/** Storage path of a public object URL in a bucket, e.g. ".../public/avatars/<uid>/x.jpg" → "<uid>/x.jpg". */
const storagePath = (url: string, bucket: string) => {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
};

const toProfile = (r: Row): Profile => ({
  id: r.id, handle: r.handle, name: r.name, home: r.home, bio: r.bio, hue: r.hue, styles: r.styles ?? [],
  preferences: { pace: "balanced", budget: "comfort", company: "solo", ...(r.preferences ?? {}) },
  visited: r.visited ?? [], watching: r.watching ?? [], socials: r.socials ?? {}, visibility: r.visibility,
  onboarded: r.onboarded ?? true, role: r.role, xp: r.xp, avatarUrl: r.avatar_url ?? null, createdAt: r.created_at,
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
  reports: r.report_count, createdAt: r.created_at, sourcePostId: r.source_post_id ?? null,
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
  [/own post/i, "ownPost"],
  [/owners cannot leave/i, "ownerCannotLeave"],
  [/only the community owner/i, "ownerOnly"],
  [/at most 6 photos/i, "tooManyPhotos"],
  [/own recommendations/i, "notYourRecommendation"],
];

/** Turns Postgres/PostgREST errors into codes the UI can translate. */
function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const { message, code } = res.error;
    if (code === "P0001") throw new ApiError(RAISED.find(([re]) => re.test(message))?.[1] ?? "generic");
    if (code === "23505") throw new ApiError("duplicate");
    if (code === "42501" && /only the community owner/i.test(message)) throw new ApiError("ownerOnly");
    if (code === "42501" && /only moderators/i.test(message)) throw new ApiError("moderatorsOnly");
    if (code === "42501" || /row-level security/i.test(message)) throw new ApiError("permission");
    if (code === "23514") throw new ApiError("invalid");
    throw new ApiError("generic");
  }
  return res.data as T;
}

/** Supabase Auth error codes mapped to translatable messages. */
const AUTH_CODES: Record<string, ErrorCode> = {
  invalid_credentials: "badCredentials",
  email_not_confirmed: "emailNotConfirmed",
  weak_password: "weakPassword",
  user_already_exists: "emailTaken",
  email_exists: "emailTaken",
  over_email_send_rate_limit: "tooManyRequests",
  over_request_rate_limit: "tooManyRequests",
  same_password: "samePassword",
  email_address_invalid: "invalidEmail",
  otp_expired: "linkExpired",
  provider_disabled: "providerDisabled",
};

const authError = (e: { message: string; code?: string }) => {
  if (e.code && AUTH_CODES[e.code]) return new ApiError(AUTH_CODES[e.code]);
  if (e.message === "Invalid login credentials") return new ApiError("badCredentials");
  if (/provider is not enabled|unsupported provider/i.test(e.message)) return new ApiError("providerDisabled");
  return new ApiError("authFailed", { message: e.message });
};

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
      if (error) throw authError(error);
    },
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw authError(error);
    },
    async signUpWithPassword(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
      if (error) throw authError(error);
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
      if (error) throw authError(error);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    onPasswordRecovery(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") cb();
      });
      return () => data.subscription.unsubscribe();
    },
    async authProviders() {
      try {
        const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
        const body = await res.json();
        return { google: !!body?.external?.google };
      } catch {
        return { google: false };
      }
    },
    async requestPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
      if (error) throw authError(error);
    },
    async updatePassword(newPassword, currentPassword) {
      if (currentPassword !== undefined) {
        const { data } = await sb.auth.getSession();
        const email = data.session?.user.email;
        if (!email) throw new ApiError("signInFirst");
        const check = await sb.auth.signInWithPassword({ email, password: currentPassword });
        if (check.error) throw new ApiError("wrongCurrentPassword");
      }
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw authError(error);
    },
    async resendVerification(email) {
      const { error } = await sb.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirectTo() } });
      if (error) throw authError(error);
    },
    async changeEmail(newEmail) {
      const { error } = await sb.auth.updateUser({ email: newEmail.trim() }, { emailRedirectTo: redirectTo() });
      if (error) throw authError(error);
    },
    async deleteAccount() {
      check(await sb.rpc("delete_my_account"));
      await sb.auth.signOut();
    },

    async getMyProfile() {
      const { data } = await sb.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return null;
      const rows = check(await sb.rpc("get_my_profile")) as Row[];
      return rows?.[0] ? toProfile(rows[0]) : null;
    },
    async updateMyProfile(patch) {
      const id = await uid();
      const row: Row = {};
      for (const [k, v] of Object.entries(patch)) row[k] = v;
      check(await sb.from("profiles").update(row).eq("id", id));
      const me = await api.getMyProfile();
      if (!me) throw new ApiError("generic");
      return me;
    },
    async handleAvailable(handle) {
      return check(await sb.rpc("handle_available", { candidate: handle })) as boolean;
    },
    async getProfile(id) {
      const row = check(await sb.from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle());
      return row ? toProfile(row) : null;
    },
    async profileStats(userId) {
      return (check(await sb.rpc("profile_stats", { p: userId })) as any) ?? null;
    },
    async setAvatar(photo) {
      const id = await uid();
      const before = (await api.getMyProfile())?.avatarUrl ?? null;
      let url: string | null = null;
      if (photo) {
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from("avatars").upload(path, photo, { contentType: "image/jpeg", upsert: false });
        if (error) throw new ApiError("photoUpload");
        url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      check(await sb.from("profiles").update({ avatar_url: url }).eq("id", id));
      const old = before && storagePath(before, "avatars");
      if (old) await sb.storage.from("avatars").remove([old]);
      const me = await api.getMyProfile();
      if (!me) throw new ApiError("generic");
      return me;
    },
    async listFollowers(userId) {
      const rows = check(await sb.from("follows").select(`p:profiles!follows_follower_id_fkey(${AUTHOR_COLS})`).eq("followee_id", userId).order("created_at", { ascending: false }).limit(500));
      return rows.map((r: Row) => toAuthor(r.p)).filter(Boolean) as AuthorRef[];
    },
    async listFollowees(userId) {
      const rows = check(await sb.from("follows").select(`p:profiles!follows_followee_id_fkey(${AUTHOR_COLS})`).eq("follower_id", userId).order("created_at", { ascending: false }).limit(500));
      return rows.map((r: Row) => toAuthor(r.p)).filter(Boolean) as AuthorRef[];
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
          ...(gem.sourcePostId ? { source_post_id: gem.sourcePostId } : {}),
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

    async listCommunities() {
      return check(await sb.from("communities").select("*").order("member_count", { ascending: false }).order("name").limit(500)).map(toCommunity);
    },
    async getCommunity(id) {
      const row = check(await sb.from("communities").select("*").eq("id", id).maybeSingle());
      return row ? toCommunity(row) : null;
    },
    async createCommunity(c) {
      const res = await sb.from("communities").insert(communityRow(c)).select("*").single();
      if (res.error?.code === "23505") throw new ApiError("communityNameTaken");
      return toCommunity(check(res));
    },
    async updateCommunity(id, patch) {
      const res = await sb.from("communities").update(communityRow(patch)).eq("id", id);
      if (res.error?.code === "23505") throw new ApiError("communityNameTaken");
      check(res);
    },
    async deleteCommunity(id) {
      check(await sb.from("communities").delete().eq("id", id));
    },
    async myMemberships() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("community_members").select("community_id, role, created_at").eq("user_id", data.session.user.id))
        .map((r: Row) => ({ communityId: r.community_id, role: r.role, joinedAt: r.created_at }));
    },
    async setMembership(communityId, on) {
      if (on) check(await sb.from("community_members").insert({ community_id: communityId }));
      else check(await sb.from("community_members").delete().match({ community_id: communityId, user_id: await uid() }));
    },
    async listMembers(communityId) {
      const rows = check(await sb.from("community_members").select(`role, created_at, p:profiles!community_members_user_id_fkey(${AUTHOR_COLS})`)
        .eq("community_id", communityId).order("created_at").limit(500));
      const rank = { owner: 0, moderator: 1, member: 2 } as const;
      return rows.filter((r: Row) => r.p).map((r: Row): Member => ({ ...(toAuthor(r.p) as AuthorRef), role: r.role }))
        .sort((a: Member, b: Member) => rank[a.role] - rank[b.role]);
    },
    async setMemberRole(communityId, userId, role) {
      check(await sb.rpc("set_member_role", { p_community: communityId, p_user: userId, p_role: role }));
    },
    async removeMember(communityId, userId) {
      const res = await sb.from("community_members").delete().match({ community_id: communityId, user_id: userId }).select("user_id");
      if (!check(res).length) throw new ApiError("permission");
    },
    async communitiesOf(userId) {
      const rows = check(await sb.from("community_members").select("c:communities(*)").eq("user_id", userId).limit(200));
      return rows.map((r: Row) => r.c).filter(Boolean).map(toCommunity);
    },

    async listPosts(f) {
      let q = sb.from("community_posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(f.limit ?? 50);
      if (f.communityId) q = q.eq("community_id", f.communityId);
      if (f.communityIds) {
        if (!f.communityIds.length) return [];
        q = q.in("community_id", f.communityIds);
      }
      if (f.authorId) q = q.eq("author_id", f.authorId);
      if (f.destinationId) q = q.eq("destination_id", f.destinationId);
      if (f.ids) {
        if (!f.ids.length) return [];
        q = q.in("id", f.ids);
      }
      return check(await q).map(toPost);
    },
    async getPost(id) {
      const row = check(await sb.from("community_posts").select(POST_SELECT).eq("id", id).maybeSingle());
      return row ? toPost(row) : null;
    },
    async createPost(p, photos) {
      const id = await uid();
      const urls: string[] = [];
      for (const blob of photos.slice(0, 6)) {
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from("community-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new ApiError("photoUpload");
        urls.push(sb.storage.from("community-media").getPublicUrl(path).data.publicUrl);
      }
      const row = check<Row>(await sb.from("community_posts").insert({
        community_id: p.communityId, kind: p.kind, title: p.title.trim(), body: p.body.trim(), destination_id: p.destinationId, place: p.place.trim(),
      }).select("id").single());
      if (urls.length) check(await sb.from("post_media").insert(urls.map((url, position) => ({ post_id: row.id, url, position }))));
      const post = await api.getPost(row.id);
      if (!post) throw new ApiError("generic");
      return post;
    },
    async updatePost(id, p) {
      const row: Row = {};
      if (p.kind !== undefined) row.kind = p.kind;
      if (p.title !== undefined) row.title = p.title.trim();
      if (p.body !== undefined) row.body = p.body.trim();
      if (p.destinationId !== undefined) row.destination_id = p.destinationId;
      if (p.place !== undefined) row.place = p.place.trim();
      check(await sb.from("community_posts").update(row).eq("id", id));
    },
    async deletePost(id) {
      const post = await api.getPost(id);
      check(await sb.from("community_posts").delete().eq("id", id));
      // Remove the author's own photo files (moderators can't delete other people's files; the rows are gone either way).
      const me = (await sb.auth.getSession()).data.session?.user.id;
      if (post && post.authorId === me) {
        const paths = post.photos.map((u) => storagePath(u, "community-media")).filter(Boolean) as string[];
        if (paths.length) await sb.storage.from("community-media").remove(paths);
      }
    },
    async myLikes() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("post_likes").select("post_id")).map((r: Row) => r.post_id);
    },
    async setLike(postId, on) {
      if (on) check(await sb.from("post_likes").insert({ post_id: postId }));
      else check(await sb.from("post_likes").delete().match({ post_id: postId, user_id: await uid() }));
    },
    async mySavedPosts() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return [];
      return check(await sb.from("post_saves").select("post_id").order("created_at", { ascending: false })).map((r: Row) => r.post_id);
    },
    async setPostSaved(postId, on) {
      if (on) check(await sb.from("post_saves").upsert({ post_id: postId }, { onConflict: "post_id,user_id", ignoreDuplicates: true }));
      else check(await sb.from("post_saves").delete().match({ post_id: postId, user_id: await uid() }));
    },
    async listComments(postId) {
      return check(await sb.from("post_comments").select(COMMENT_SELECT).eq("post_id", postId).order("created_at").limit(500)).map(toComment);
    },
    async createComment(postId, body) {
      return toComment(check(await sb.from("post_comments").insert({ post_id: postId, body: body.trim() }).select(COMMENT_SELECT).single()));
    },
    async updateComment(id, body) {
      check(await sb.from("post_comments").update({ body: body.trim() }).eq("id", id));
    },
    async deleteComment(id) {
      check(await sb.from("post_comments").delete().eq("id", id));
    },
    async gemFromPost(postId) {
      const row = check(await sb.from("gems").select(GEM_SELECT).eq("source_post_id", postId).maybeSingle());
      return row ? toGem(row) : null;
    },

    async xpHistory() {
      const rows = check(await sb.from("xp_events").select("*").order("created_at", { ascending: false }).limit(100));
      return rows.map((r: Row): XpEvent => ({ id: String(r.id), amount: r.amount, reason: r.reason, ref: r.ref, createdAt: r.created_at }));
    },

    async moderationQueue() {
      const [gems, tips, posts, comments, communities, reports] = await Promise.all([
        sb.from("gems").select(GEM_SELECT).in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("tips").select(TIP_SELECT).in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("community_posts").select(POST_SELECT).in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("post_comments").select(COMMENT_SELECT).in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("communities").select("*").in("status", ["pending", "hidden"]).order("created_at"),
        sb.from("reports").select("*").eq("status", "open").order("created_at"),
      ]);
      return {
        gems: check(gems).map(toGem), tips: check(tips).map(toTip), posts: check(posts).map(toPost), comments: check(comments).map(toComment),
        communities: check(communities).map(toCommunity), reports: check(reports).map(toReport),
      };
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
