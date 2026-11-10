// Packages the discoverorbis.com page as orbis-site.zip (orbis-site/index.html, site.js, config.js)
// for hosts other than this Vercel project. Links to the app use an absolute URL there.
// Usage: [APP_URL=https://…/app/] node scripts/zip-site.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const appUrl = process.env.APP_URL || "https://orbis-alpha-green.vercel.app/app/";
const site = new URL("../site/", import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), "orbis-site-"));
const dir = join(tmp, "orbis-site");
mkdirSync(dir);
copyFileSync(join(site, "index.html"), join(dir, "index.html"));
copyFileSync(join(site, "site.js"), join(dir, "site.js"));
const config = readFileSync(join(site, "config.js"), "utf8").replace(/"appUrl":"[^"]*"/, `"appUrl":${JSON.stringify(appUrl)}`);
writeFileSync(join(dir, "config.js"), config);
const out = new URL("../orbis-site.zip", import.meta.url).pathname;
rmSync(out, { force: true });
execFileSync("zip", ["-q", "-r", out, "orbis-site"], { cwd: tmp });
rmSync(tmp, { recursive: true, force: true });
console.log(`orbis-site.zip written (app links → ${appUrl})`);
