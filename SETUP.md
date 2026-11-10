# Taking Orbis live

Orbis runs in **demo mode** (data saved in the browser) until you connect a backend. This guide covers everything needed for a real launch, in order. Items marked **Required** block launch; the rest can follow.

## What you need

| What | Why | Cost to start | Required? |
| --- | --- | --- | --- |
| [Supabase](https://supabase.com) project | Database, sign-in, photo storage, scheduled jobs | Free tier | **Required** |
| Email sending (SMTP) such as [Resend](https://resend.com) or [Postmark](https://postmarkapp.com) | Sign-in links and confirmations. Supabase's built-in email is rate-limited and for testing only | Free tier | **Required** |
| Web hosting such as [Vercel](https://vercel.com), [Netlify](https://netlify.com) or Cloudflare Pages | Serves the app | Free tier | **Required** |
| A domain name | Your app's address and sender address for email | ~$12/year | **Required** |
| Privacy policy and terms of use | Legally required when you collect accounts and photos | Lawyer or a reputable generator | **Required** |
| Google Cloud OAuth client | "Continue with Google" | Free | Optional |
| [Ticketmaster Discovery API](https://developer.ticketmaster.com) key | Automatic Global Pulse events | Free (5,000 calls/day) | Optional |
| Map tiles | Uses [OpenFreeMap](https://openfreemap.org) by default (free, no key). Switch to MapTiler or similar if you need an SLA | Free | No action needed |

Nothing in the app needs a paid plan to start. Expect to move to Supabase Pro (about $25/month) once you have real traffic, for daily backups and no project pausing.

## 1. Create the Supabase project (Required)

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to most users.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this repo:

```bash
supabase login
```

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

```bash
supabase db push
```

`db push` applies everything in `supabase/migrations`: tables, security rules, moderation, XP and the photo bucket.

3. Load the curated destinations and starter gems. Run `supabase/seed.sql` in the dashboard's **SQL Editor** (paste and run). It's safe to run again.
4. The seed includes **sample** Global Pulse events so the feed isn't empty. Remove them before launch, or once real events are syncing:

```sql
delete from public.events where source = 'sample';
```

> **Status for the Orbis project (Nov 2026):** migrations 1–6 and the seed are applied to the live project `anqlngiqsfhsyxpglfmt`, the site URL is `https://app.discoverorbis.com` (redirect URLs also allow `orbis-alpha-green.vercel.app` and preview deployments), and the minimum password length is 8. The remaining steps below are the ones still to do in the dashboard.

## 2. Connect the app (Required)

Copy `.env.example` to `.env.local` and fill in the two values from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

On Vercel, add the two variables under **Project → Settings → Environment Variables** for Production and Preview, then redeploy. Either naming works: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, or the `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` names the Supabase integration creates (only if the integration is actually linked to this Vercel project).

If the variables are missing, the production site shows "Orbis isn't connected yet" rather than silently saving data in visitors' browsers.

The anon key is meant to be public. Everything is protected by the database's row-level security. **Never** put the `service_role` key in the app.

Run `npm run dev`. The "Demo mode" banner disappears when the backend is connected.

## 3. Sign-in (Required)

In the dashboard, under **Authentication**:

1. **URL Configuration**: set *Site URL* to your production address (e.g. `https://orbis.app`) and add it, plus `http://localhost:5173`, to *Redirect URLs*.
2. **SMTP Settings**: enable custom SMTP with your email provider's credentials, and a sender like `hello@yourdomain`. Without this, Supabase only sends a handful of emails per hour.
3. **Email templates**: edit the magic link and confirmation emails to say Orbis.
4. Optional: **Providers → Google**. Create an OAuth client in Google Cloud Console (type *Web application*), add the redirect URL Supabase shows you, and paste the client ID and secret.

## 4. Make yourself a moderator (Required)

Sign up in the app, then run this in the SQL Editor with your handle:

```sql
update public.profiles set role = 'admin' where handle = 'your_handle';
```

A **Moderation queue** button then appears on your Passport. Review it daily at launch.

How moderation works:
- Gems and field notes containing links, phone numbers or email addresses are held for review.
- Anything reported by 3 different people is hidden until a moderator decides.
- Add words to auto-hold in **Table Editor → blocked_terms**.
- People can be limited per day: 10 gems, 20 notes, 20 trips, 30 reports.

## 5. Deploy the app (Required)

On Vercel or Netlify: import the GitHub repo, set build command `npm run build`, output directory `dist`, and add the two `VITE_SUPABASE_*` environment variables. Then point your domain at it and update the Site URL from step 3.

The app lives at **app.discoverorbis.com** (Vercel). The marketing site, discoverorbis.com, is hosted separately on Netlify from the `site/` folder.

## Waitlist (discoverorbis.com)

- Signups from the marketing site are stored in `public.waitlist_signups`. Open **Table Editor → waitlist_signups** to see them, or export them as CSV from there.
- **Fields:** email (unique, case-insensitive), first name, interests, note, source, UTM tags, referrer, language, consent time, and `user_id` once that person creates an app account.
- **Writes:** only through `join_waitlist()`, which checks the email format, drops bot submissions (a hidden honeypot field) and allows 8 attempts per visitor per hour and 500 per hour overall. Visitor IPs are stored only as daily salted hashes.
- **Reads:** the public API can't read the table, whether signed in or not.
- **Removing someone:** delete their row in Table Editor.
- The page is hosted on Netlify, separately from the app. See `site/README.md`.

## 6. Automatic events (Optional)

1. Get a free key at [developer.ticketmaster.com](https://developer.ticketmaster.com).
2. Deploy the function and set its secrets (choose any long random string for `SYNC_SECRET`):

```bash
supabase functions deploy sync-events
```

```bash
supabase secrets set TICKETMASTER_API_KEY=your_key SYNC_SECRET=your_long_random_string
```

3. Schedule it daily. In the SQL Editor, enable the `pg_cron` and `pg_net` extensions (**Database → Extensions**), then:

```sql
select cron.schedule('sync-events-daily', '17 4 * * *', $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-events',
    headers := jsonb_build_object('x-sync-secret', 'your_long_random_string')
  );
$$);
```

Ticketmaster coverage is strongest in North America, Europe and Australia. For places it doesn't cover, add events by hand in **Table Editor → events** with `source = 'editorial'`.

## 7. Before you announce it

- [ ] Privacy policy and terms published and linked from your site
- [ ] Sample events deleted
- [ ] Custom SMTP working (test a sign-in link from a phone)
- [ ] At least one moderator account
- [ ] Supabase **Database → Backups** checked (daily backups need the Pro plan)
- [ ] Tried the full loop on a phone: save a gem, plan a trip from Saved, share a gem with a photo

## Testing

```bash
npm test
```

Unit tests: suggestions, moderation rules, demo backend, event mapping.

```bash
npm run test:db
```

Runs the migrations, seed and 61 security and behaviour checks against a throwaway local PostgreSQL 16. Both run in CI on every pull request.
