export const APP_NAME = "Orbis";
export const APP_SLOGAN = "See beyond the destination";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function ago(minutes: number) {
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.round(minutes / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function compact(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const parseDate = (iso: string) => new Date(iso + "T12:00:00");

export function fmtShort(iso: string) {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtRange(from: string, to: string) {
  const a = parseDate(from);
  const b = parseDate(to);
  return a.getMonth() === b.getMonth()
    ? `${MONTHS[a.getMonth()]} ${a.getDate()}–${b.getDate()}`
    : `${fmtShort(from)} – ${fmtShort(to)}`;
}

export function addDays(iso: string, n: number) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDayLong(iso: string) {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
}

/** World-atlas uses abbreviated names; show friendlier ones. */
const PRETTY: Record<string, string> = {
  "United States of America": "United States",
  "Bosnia and Herz.": "Bosnia & Herzegovina",
  Macedonia: "North Macedonia",
  "Dominican Rep.": "Dominican Republic",
  "Central African Rep.": "Central African Rep.",
  "Dem. Rep. Congo": "DR Congo",
  "S. Sudan": "South Sudan",
  "Eq. Guinea": "Equatorial Guinea",
  "Solomon Is.": "Solomon Islands",
  "Falkland Is.": "Falkland Islands",
  "Fr. S. Antarctic Lands": "French Southern Lands",
  "N. Cyprus": "Northern Cyprus",
  "W. Sahara": "Western Sahara",
  eSwatini: "Eswatini",
};
export const prettyCountry = (n: string) => PRETTY[n] ?? n;

/** Share via the OS sheet when available, otherwise copy to the clipboard. Resolves true on success. */
export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "Nov 9" or "Nov 9 – 12" for event dates (ISO timestamps). */
export function fmtEventDate(startIso: string, endIso: string | null) {
  const a = new Date(startIso);
  const b = endIso ? new Date(endIso) : null;
  const md = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (!b || b.getTime() - a.getTime() < 86400000) return md(a);
  return a.getMonth() === b.getMonth() ? `${md(a)} – ${b.getDate()}` : `${md(a)} – ${md(b)}`;
}
