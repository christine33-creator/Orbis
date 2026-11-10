# discoverorbis.com

The public marketing page, with the waitlist. It's plain static files with no framework:

| File | What it is |
| --- | --- |
| `index.html` | Page markup and styles |
| `site.js` | Globe, interactive app preview, Global Pulse countdowns, waitlist form |
| `config.js` | Generated: public Supabase URL and publishable key, app URL, globe land mask |

- **Waitlist:** the form calls Supabase's `join_waitlist()` on the same project as the app. Signups land in `public.waitlist_signups` (**Supabase → Table Editor**). The public can't read it.
- **Security headers:** no inline scripts, so the page works under the strict Content-Security-Policy in `vercel.json`.
- **Old sign-in links:** confirmation and reset links that point at the site root are forwarded to the app with their tokens.

## Where it's served

On the Vercel project, `npm run build` builds the app into `dist/app/` and copies these files to the root of `dist/`:

- `https://<domain>/` → this page
- `https://<domain>/app/` → the Orbis app

To serve it on discoverorbis.com, add the domain under **Vercel → Project → Settings → Domains** (and remove it from wherever the old page is hosted). Both `discoverorbis.com` and `www.discoverorbis.com` are already allowed as sign-in redirect URLs in Supabase.

## Editing

Edit `index.html` or `site.js` directly. Regenerate `config.js` only if the Supabase project or app URL changes:

```bash
SUPABASE_URL=https://anqlngiqsfhsyxpglfmt.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_… npm run site:build
```

Only the publishable (anon) key goes in this page. The script refuses `service_role` and secret keys.

## Hosting it somewhere else

```bash
npm run site:zip
```

writes `orbis-site.zip` (`orbis-site/index.html`, `site.js`, `config.js`) with app links pointing at `https://orbis-alpha-green.vercel.app/app/`. Upload the three files together; any static host works.
