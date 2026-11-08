// Builds site/index.html (the discoverorbis.com page) from site/index.template.html.
// Usage: SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… node scripts/build-site.mjs
// Only the public (anon/publishable) key belongs here — never the service_role key.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
if (/service_role|^sb_secret_/.test(key)) throw new Error("Refusing to embed a secret key in a public page");

const land = execFileSync("node", [new URL("./site-landmask.mjs", import.meta.url).pathname]).toString().trim();
const html = readFileSync(new URL("../site/index.template.html", import.meta.url), "utf8")
  .replace("__SUPABASE_URL__", url)
  .replace("__SUPABASE_KEY__", key)
  .replace("__LANDMASK__", land);
writeFileSync(new URL("../site/index.html", import.meta.url), html);
console.log(`site/index.html written (${(html.length / 1024).toFixed(1)} KB)`);
