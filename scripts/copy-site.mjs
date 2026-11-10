// After `vite build` (app → dist/app), put the discoverorbis.com page at the root of dist.
import { copyFileSync, existsSync } from "node:fs";

for (const f of ["index.html", "site.js", "config.js"]) {
  const from = new URL(`../site/${f}`, import.meta.url);
  if (!existsSync(from)) throw new Error(`site/${f} is missing (run npm run site:build to create config.js)`);
  copyFileSync(from, new URL(`../dist/${f}`, import.meta.url));
}
console.log("Copied the site to dist/ (app is in dist/app/)");
