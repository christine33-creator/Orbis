import type { Profile, Traveler, Trip } from "../types";
import { parseDate } from "./util";

/**
 * Companion "sync rate": how well another traveller lines up with you.
 * Weighs shared travel styles, matching destination, and overlapping dates.
 */
export function syncRate(me: Profile, trips: Trip[], other: Traveler): number {
  const shared = other.styles.filter((s) => me.styles.includes(s)).length;
  const styleScore = shared / Math.max(1, Math.min(other.styles.length, me.styles.length));

  let tripScore = 0;
  const pt = other.plannedTrip;
  if (pt) {
    for (const t of trips) {
      if (t.destinationId !== pt.destinationId) continue;
      const aStart = parseDate(t.startDate).getTime();
      const aEnd = aStart + t.days.length * 86400000;
      const bStart = parseDate(pt.from).getTime();
      const bEnd = parseDate(pt.to).getTime() + 86400000;
      const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
      tripScore = Math.max(tripScore, 0.5 + 0.5 * Math.min(1, overlap / (3 * 86400000)));
    }
    if (!tripScore && me.watching.includes(pt.destinationId)) tripScore = 0.35;
  }
  const raw = 0.45 * styleScore + 0.45 * tripScore + 0.1 * Math.min(1, other.level / 10);
  return Math.round(55 + raw * 44);
}
