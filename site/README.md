# discoverorbis.com

The public marketing page, with the waitlist. Hosted on **Netlify**, separately from the app (which is at **app.discoverorbis.com** on Vercel). It's plain static files with no build step:

| File | What it is |
| --- | --- |
| `index.html` | Page markup and styles |
| `site.js` | Globe, interactive app preview, Global Pulse countdowns, waitlist form |
| `config.js` | Generated: public Supabase URL and publishable key, app URL, globe land mask |
| `_headers` | Security headers (Netlify reads this file) |

- **Waitlist:** the form calls Supabase's `join_waitlist()` on the same project as the app. Signups land in `public.waitlist_signups` (**Supabase → Table Editor**). The public can't read it.
- **Links to the app** (Sign in) go to `https://app.discoverorbis.com/`.
- No inline scripts, so a strict Content-Security-Policy works.

## Deploying on Netlify

Either:

- **From the repo (updates automatically):** Netlify → Add new site → Import from GitHub → this repo. Leave the build command empty and set the **publish directory** to `site`.
- **By hand:** run `npm run site:zip`, unzip `orbis-site.zip` and drag the `orbis-site` folder onto Netlify's deploy page.

Then attach `discoverorbis.com` (and `www`) under **Domain management**.

## Editing

Edit `index.html` or `site.js` directly. Regenerate `config.js` only if the Supabase project or app address changes:

```bash
SUPABASE_URL=https://anqlngiqsfhsyxpglfmt.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_… [APP_URL=https://app.discoverorbis.com/] npm run site:build
```

Only the publishable (anon) key goes in this page. The script refuses `service_role` and secret keys.
