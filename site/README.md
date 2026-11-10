# discoverorbis.com

The public marketing page. A single static file, `index.html`, with no build step needed to host it.

- **Waitlist:** the form calls Supabase's `join_waitlist()` function on the same project as the app. Signups land in `public.waitlist_signups`, which you can view in **Supabase → Table Editor**. The public can't read it.
- **Editing:** change `index.template.html`, then regenerate `index.html`:

  ```bash
  SUPABASE_URL=https://anqlngiqsfhsyxpglfmt.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_… npm run site:build
  ```

  Only the publishable (anon) key goes in this page. The build refuses `service_role` and secret keys.

## Deploying

Upload `index.html` wherever discoverorbis.com is hosted, replacing the old page. On Vercel, a simple setup:

1. **Add New → Project**, import this repo, and set **Root Directory** to `site`. Framework preset: **Other**. No build command.
2. Under **Settings → Domains**, add `discoverorbis.com` (and `www`) and move the domain from the old project if it's attached there.
