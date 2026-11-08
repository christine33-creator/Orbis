// Prints a compact land/sea bitmask (every 2.5°) for the marketing-site globe.
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json");
const land = feature(world, world.objects.countries);
const STEP = 2.5, rows = [], bits = [];
for (let lat = 85; lat >= -60; lat -= STEP) for (let lng = -180; lng < 180; lng += STEP) bits.push(land.features.some((f) => geoContains(f, [lng, lat])) ? 1 : 0);
const bytes = Buffer.alloc(Math.ceil(bits.length / 8));
bits.forEach((b, i) => { if (b) bytes[i >> 3] |= 1 << (i & 7); });
console.log(JSON.stringify({ step: STEP, top: 85, bottom: -60, cols: 360 / STEP, data: bytes.toString("base64"), land: bits.filter(Boolean).length }));
