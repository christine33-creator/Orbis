/**
 * Business rules shared by the local demo backend and the UI. The production equivalents
 * live in the database (supabase/migrations) and are the source of truth there.
 */

/** Mirrors public.needs_review(): links, phone numbers and emails are held for review. */
export function needsReview(text: string, blockedTerms: string[] = []): boolean {
  const t = text ?? "";
  if (/(https?:\/\/|www\.)/i.test(t)) return true;
  if (/[0-9][0-9 ().+-]{8,}[0-9]/.test(t)) return true;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return true;
  const lower = t.toLowerCase();
  return blockedTerms.some((term) => lower.includes(term.toLowerCase()));
}

/** Reports from this many different people hide content until a moderator reviews it. */
export const REPORT_HIDE_THRESHOLD = 3;

export const HANDLE_RE = /^[a-z0-9_.]{3,30}$/;

export const DAILY_LIMITS = { gems: 10, tips: 20, trips: 20, reports: 30, communities: 3, posts: 20, comments: 100, joins: 50, likes: 500 } as const;

export const XP_AWARDS = {
  profile_completed: 100,
  country_stamped: 15,
  gem_published: 50,
  tip_published: 40,
  upvote_received: 2,
  saved: 5,
  trip_created: 60,
  stop_done: 15,
  followed: 5,
  post_published: 20,
  comment_published: 5,
  like_received: 2,
  community_joined: 10,
  community_created: 30,
} as const;

/** Mirrors the database's daily XP caps per reason. */
export const XP_DAILY_CAPS: Partial<Record<keyof typeof XP_AWARDS, number>> = {
  post_published: 100, comment_published: 50, like_received: 100, community_joined: 50, community_created: 60,
};

/** Readable community address, like the database's slug trigger. */
export function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (base.length < 3 ? "community" : base).slice(0, 48);
}

export type XpReason = keyof typeof XP_AWARDS;
