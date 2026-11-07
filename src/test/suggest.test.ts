import { describe, expect, it } from "vitest";
import { suggest, savedForDestination } from "../lib/suggest";
import { needsReview } from "../lib/rules";
import { DESTINATIONS } from "../data/destinations";
import type { Gem, PulseEvent } from "../types";

const gem = (over: Partial<Gem>): Gem => ({
  id: "g", authorId: "a", author: null, destinationId: "kyoto", name: "Spot", description: "A nice place", tip: "",
  category: "culture", styles: ["culture"], lat: 0, lng: 0, country: "Japan", photos: [], status: "published",
  upvotes: 0, saves: 0, reports: 0, createdAt: "2026-01-01T00:00:00Z", ...over,
});
const event = (over: Partial<PulseEvent>): PulseEvent => ({
  id: "e", destinationId: "lisbon", city: "Lisbon", category: "tech", title: "Meetup", summary: "", startsAt: "2026-11-10T00:00:00Z",
  endsAt: null, url: null, imageUrl: null, lat: null, lng: null, source: "sample", ...over,
});
const now = new Date("2026-11-07T00:00:00Z");

describe("suggest", () => {
  it("ranks destinations that match the person's styles and explains why", () => {
    const out = suggest({ profile: { styles: ["adventure", "eco"], visited: [], watching: [] }, saves: [], destinations: DESTINATIONS, gems: [], events: [], now });
    const top = DESTINATIONS.find((d) => d.id === out[0].id)!;
    expect(top.styles).toEqual(expect.arrayContaining(["adventure"]));
    expect(out[0].reasons.join(" ")).toMatch(/adventure|nature/);
  });

  it("boosts gems near destinations the person saved", () => {
    const near = gem({ id: "near", destinationId: "lisbon", country: "Portugal", styles: [] });
    const far = gem({ id: "far", destinationId: "tokyo", styles: [] });
    const out = suggest({
      profile: { styles: [], visited: [], watching: [] },
      saves: [{ itemType: "destination", itemId: "lisbon", createdAt: "" }],
      destinations: DESTINATIONS, gems: [near, far], events: [], now,
    });
    const ids = out.filter((s) => s.itemType === "gem").map((s) => s.id);
    expect(ids[0]).toBe("near");
    expect(out.find((s) => s.id === "near")!.reasons[0]).toMatch(/Lisbon/);
  });

  it("never suggests things already saved, or unpublished gems", () => {
    const out = suggest({
      profile: { styles: ["culture"], visited: [], watching: [] },
      saves: [{ itemType: "gem", itemId: "saved", createdAt: "" }],
      destinations: [], gems: [gem({ id: "saved" }), gem({ id: "pending", status: "pending" }), gem({ id: "ok" })], events: [], now,
    });
    expect(out.map((s) => s.id)).toEqual(["ok"]);
  });

  it("surfaces events happening soon at places on the radar", () => {
    const out = suggest({ profile: { styles: [], visited: [], watching: ["lisbon"] }, saves: [], destinations: [], gems: [], events: [event({})], now });
    expect(out[0]).toMatchObject({ itemType: "event", id: "e" });
    expect(out[0].reasons).toContain("Happening soon");
  });

  it("works for signed-out visitors", () => {
    const out = suggest({ profile: null, saves: [], destinations: DESTINATIONS, gems: [gem({ upvotes: 300 })], events: [], now });
    expect(out.length).toBeGreaterThan(0);
  });

  it("finds saved stops for a destination", () => {
    const saves = [
      { itemType: "gem" as const, itemId: "g1", createdAt: "" },
      { itemType: "event" as const, itemId: "e1", createdAt: "" },
      { itemType: "gem" as const, itemId: "g2", createdAt: "" },
    ];
    const res = savedForDestination("kyoto", { saves, gems: [gem({ id: "g1" }), gem({ id: "g2", destinationId: "tokyo" })], events: [event({ id: "e1", destinationId: "kyoto" })] });
    expect(res.map((s) => s.itemId)).toEqual(["g1", "e1"]);
  });
});

describe("needsReview (mirrors the database rule)", () => {
  it.each([
    ["Lovely quiet cove", false],
    ["Book at https://example.com", true],
    ["see www.example.com", true],
    ["Call +351 912 345 678", true],
    ["email me at a@b.co", true],
    ["Opens 9:00 to 17:00, about 25 minutes walk", false],
  ])("%s → %s", (text, expected) => expect(needsReview(text)).toBe(expected));
});
