import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { pt } from "../i18n/locales/pt";
import { de } from "../i18n/locales/de";
import { ja } from "../i18n/locales/ja";

type Tree = { [k: string]: string | Tree };
const LOCALES: Record<string, Tree> = { es, fr, pt, de, ja };

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));
}
function lookup(tree: Tree, path: string): string | Tree | undefined {
  return path.split(".").reduce<string | Tree | undefined>((node, k) => (node && typeof node === "object" ? node[k] : undefined), tree);
}
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "test" || f === "locales" ? [] : sourceFiles(p);
    return /\.(tsx?|ts)$/.test(f) ? [p] : [];
  });
}
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

const srcDir = join(__dirname, "..");
const code = sourceFiles(srcDir).map((f) => [f, readFileSync(f, "utf8")] as const);

describe("translations", () => {
  it("every literal key used in the UI exists in English", () => {
    const missing: string[] = [];
    for (const [file, text] of code) {
      for (const m of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
        if (typeof lookup(en, m[1]) !== "string") missing.push(`${m[1]} (${file.replace(srcDir, "src")})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every dynamic key points into an existing group", () => {
    const missing: string[] = [];
    for (const [file, text] of code) {
      for (const m of text.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) {
        if (typeof lookup(en, m[1]) !== "object") missing.push(`${m[1]} (${file.replace(srcDir, "src")})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s has every key, no empty strings, and the same placeholders", (code) => {
    const target = LOCALES[code];
    for (const [key, value] of leaves(en as unknown as Tree)) {
      const v = lookup(target, key);
      expect(typeof v, `${code}: ${key}`).toBe("string");
      expect((v as string).trim().length, `${code}: ${key} is empty`).toBeGreaterThan(0);
      expect(placeholders(v as string), `${code}: ${key} placeholders`).toEqual(placeholders(value));
    }
  });
});
