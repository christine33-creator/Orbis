// Pure mapping from Ticketmaster Discovery API v2 events to rows in public.events.
// Kept free of Deno APIs so it can be unit tested with Vitest.

export interface Destination {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface TmEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  dates?: { start?: { localDate?: string; dateTime?: string }; end?: { localDate?: string; dateTime?: string } };
  classifications?: { segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }[];
  images?: { url: string; width?: number; ratio?: string }[];
  _embedded?: { venues?: { name?: string; city?: { name?: string }; location?: { latitude?: string; longitude?: string } }[] };
}

export interface EventRow {
  destination_id: string;
  city: string;
  category: "sports" | "tech" | "fashion" | "art" | "music" | "food" | "festival" | "other";
  title: string;
  summary: string;
  starts_at: string;
  ends_at: string | null;
  url: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  source: "ticketmaster";
  external_id: string;
}

export function categoryFor(e: TmEvent): EventRow["category"] {
  const c = e.classifications?.[0];
  const words = [c?.segment?.name, c?.genre?.name, c?.subGenre?.name, e.name].filter(Boolean).join(" ").toLowerCase();
  if (/fashion/.test(words)) return "fashion";
  if (/food|wine|culinary/.test(words)) return "food";
  if (/festival|fair/.test(words)) return "festival";
  if (/tech|conference|expo/.test(words)) return "tech";
  const seg = c?.segment?.name?.toLowerCase() ?? "";
  if (seg === "sports") return "sports";
  if (seg === "music") return "music";
  if (seg === "arts & theatre" || seg === "film") return "art";
  return "other";
}

/** Widest 16:9 image, which suits the app's cards. */
function pickImage(e: TmEvent): string | null {
  const imgs = (e.images ?? []).filter((i) => i.url?.startsWith("https://"));
  const wide = imgs.filter((i) => i.ratio === "16_9").sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return (wide[0] ?? imgs[0])?.url ?? null;
}

function toIso(d?: { localDate?: string; dateTime?: string }): string | null {
  if (!d) return null;
  if (d.dateTime) return new Date(d.dateTime).toISOString();
  if (d.localDate) return new Date(`${d.localDate}T12:00:00Z`).toISOString();
  return null;
}

export function toRow(e: TmEvent, dest: Destination): EventRow | null {
  const starts = toIso(e.dates?.start);
  if (!e.id || !e.name || !starts) return null;
  const venue = e._embedded?.venues?.[0];
  const lat = Number(venue?.location?.latitude);
  const lng = Number(venue?.location?.longitude);
  const summary = [venue?.name, e.info].filter(Boolean).join(" · ").slice(0, 400);
  return {
    destination_id: dest.id,
    city: venue?.city?.name ?? dest.name,
    category: categoryFor(e),
    title: e.name.slice(0, 200),
    summary,
    starts_at: starts,
    ends_at: toIso(e.dates?.end),
    url: e.url?.startsWith("https://") ? e.url : null,
    image_url: pickImage(e),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    source: "ticketmaster",
    external_id: e.id,
  };
}

export function searchUrl(apiKey: string, dest: Destination, from: Date, days = 60, size = 30) {
  const end = new Date(from.getTime() + days * 86400000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const p = new URLSearchParams({
    apikey: apiKey,
    latlong: `${dest.lat},${dest.lng}`,
    radius: "50",
    unit: "km",
    startDateTime: iso(from),
    endDateTime: iso(end),
    sort: "relevance,desc",
    size: String(size),
  });
  return `https://app.ticketmaster.com/discovery/v2/events.json?${p}`;
}
