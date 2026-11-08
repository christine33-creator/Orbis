// Supabase Edge Function: pulls upcoming events near each destination from the
// Ticketmaster Discovery API into public.events (the Global Pulse feed).
//
// Secrets (set with `supabase secrets set ...`):
//   TICKETMASTER_API_KEY  - free key from developer.ticketmaster.com
//   SYNC_SECRET           - any long random string; callers must send it as `x-sync-secret`
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Schedule it daily (see SETUP.md) — ~1 API call per destination per run.
import { createClient } from "npm:@supabase/supabase-js@2";
import { searchUrl, toRow, type Destination, type EventRow, type TmEvent } from "./mapping.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  const apiKey = Deno.env.get("TICKETMASTER_API_KEY");
  if (!apiKey) return new Response("TICKETMASTER_API_KEY is not set", { status: 500 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: destinations, error } = await db.from("destinations").select("id, name, lat, lng");
  if (error) return new Response(`Could not load destinations: ${error.message}`, { status: 500 });

  const now = new Date();
  const results: Record<string, number | string> = {};
  for (const dest of destinations as Destination[]) {
    try {
      const res = await fetch(searchUrl(apiKey, dest, now));
      if (res.status === 429) {
        results[dest.id] = "rate limited";
        break;
      }
      if (!res.ok) {
        results[dest.id] = `HTTP ${res.status}`;
        continue;
      }
      const body = await res.json();
      const rows = ((body?._embedded?.events ?? []) as TmEvent[])
        .map((e) => toRow(e, dest))
        .filter((r): r is EventRow => r !== null);
      if (rows.length) {
        const { error: upErr } = await db.from("events").upsert(rows, { onConflict: "source,external_id" });
        results[dest.id] = upErr ? `db error: ${upErr.message}` : rows.length;
      } else {
        results[dest.id] = 0;
      }
    } catch (e) {
      results[dest.id] = `error: ${(e as Error).message}`;
    }
    // Ticketmaster allows 5 requests per second.
    await new Promise((r) => setTimeout(r, 250));
  }

  // Drop synced events that ended more than a week ago.
  await db.from("events").delete().eq("source", "ticketmaster").lt("ends_at", new Date(now.getTime() - 7 * 86400000).toISOString());

  return Response.json({ synced: results });
});
