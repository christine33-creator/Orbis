import type { Community, Destination, Profile, TravelStyle } from "../types";

export type CommunityReason =
  | { kind: "place"; place: string }
  | { kind: "country"; country: string }
  | { kind: "styles"; styles: TravelStyle[] }
  | { kind: "popular" };

/**
 * Rule-based recommendations (no opaque ranking): communities about places you saved or
 * watch, countries you've been to, and your travel styles, then popular ones.
 */
export function recommendCommunities(
  all: Community[],
  opts: { me?: Pick<Profile, "styles" | "visited" | "watching"> | null; savedDestinationIds?: string[]; joined?: string[]; destinations?: Destination[] },
  limit = 8,
): { community: Community; reason: CommunityReason; score: number }[] {
  const joined = new Set(opts.joined ?? []);
  const places = new Set([...(opts.savedDestinationIds ?? []), ...(opts.me?.watching ?? [])]);
  const visited = new Set(opts.me?.visited ?? []);
  const styles = new Set(opts.me?.styles ?? []);
  const destName = (id: string | null) => opts.destinations?.find((d) => d.id === id)?.name ?? "";
  const destCountry = (id: string | null) => opts.destinations?.find((d) => d.id === id)?.country ?? "";

  return all
    .filter((c) => c.status === "published" && !joined.has(c.id))
    .map((c) => {
      const shared = c.styles.filter((s) => styles.has(s));
      const country = c.country || destCountry(c.destinationId);
      let reason: CommunityReason = { kind: "popular" };
      let score = Math.log10(1 + c.memberCount) + Math.log10(1 + c.postCount) / 2;
      if (shared.length) {
        score += 2 * shared.length;
        reason = { kind: "styles", styles: shared };
      }
      if (country && visited.has(country)) {
        score += 4;
        reason = { kind: "country", country };
      }
      if (c.destinationId && places.has(c.destinationId)) {
        score += 6;
        reason = { kind: "place", place: destName(c.destinationId) };
      }
      return { community: c, reason, score };
    })
    .sort((a, b) => b.score - a.score || b.community.memberCount - a.community.memberCount)
    .slice(0, limit);
}

/** Case- and accent-insensitive search over community names and descriptions. */
export function searchCommunities(all: Community[], q: string) {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return all;
  return all.filter((c) => {
    const hay = norm(`${c.name} ${c.description} ${c.country}`);
    return terms.every((t) => hay.includes(t));
  });
}
