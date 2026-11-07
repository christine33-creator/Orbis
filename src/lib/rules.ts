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

export const DAILY_LIMITS = { gems: 10, tips: 20, trips: 20, reports: 30 } as const;

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
} as const;

export type XpReason = keyof typeof XP_AWARDS;

export const XP_LABELS: Record<string, string> = {
  profile_completed: "Profile completed",
  country_stamped: "Passport stamp",
  gem_published: "Hidden gem published",
  tip_published: "Field note published",
  upvote_received: "Your gem was upvoted",
  saved: "Saved to your collection",
  trip_created: "Trip created",
  stop_done: "Checked in at a stop",
  followed: "Followed an explorer",
};
