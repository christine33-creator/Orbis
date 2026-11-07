import { describe, expect, it } from "vitest";
import { categoryFor, searchUrl, toRow, type TmEvent } from "./mapping";

const kyoto = { id: "kyoto", name: "Kyoto", lat: 35.01, lng: 135.77 };

// Shaped like a Discovery API v2 event (fields trimmed).
const sample: TmEvent = {
  id: "Z698xZu0Z1a",
  name: "Kyoto Jazz Night",
  url: "https://www.ticketmaster.com/event/Z698xZu0Z1a",
  info: "Doors 18:00",
  dates: { start: { localDate: "2026-11-20", dateTime: "2026-11-20T10:00:00Z" } },
  classifications: [{ segment: { name: "Music" }, genre: { name: "Jazz" } }],
  images: [
    { url: "https://s1.ticketm.net/small.jpg", width: 205, ratio: "16_9" },
    { url: "https://s1.ticketm.net/large.jpg", width: 1024, ratio: "16_9" },
    { url: "https://s1.ticketm.net/square.jpg", width: 2000, ratio: "1_1" },
  ],
  _embedded: { venues: [{ name: "Rohm Theatre", city: { name: "Kyoto" }, location: { latitude: "35.0137", longitude: "135.7828" } }] },
};

describe("Ticketmaster mapping", () => {
  it("maps an event to an events row", () => {
    expect(toRow(sample, kyoto)).toEqual({
      destination_id: "kyoto", city: "Kyoto", category: "music", title: "Kyoto Jazz Night", summary: "Rohm Theatre · Doors 18:00",
      starts_at: "2026-11-20T10:00:00.000Z", ends_at: null, url: "https://www.ticketmaster.com/event/Z698xZu0Z1a",
      image_url: "https://s1.ticketm.net/large.jpg", lat: 35.0137, lng: 135.7828, source: "ticketmaster", external_id: "Z698xZu0Z1a",
    });
  });

  it("uses the local date when there is no exact time, and skips events without a date", () => {
    expect(toRow({ ...sample, dates: { start: { localDate: "2026-12-01" } } }, kyoto)!.starts_at).toBe("2026-12-01T12:00:00.000Z");
    expect(toRow({ ...sample, dates: {} }, kyoto)).toBeNull();
  });

  it("falls back to the destination when the venue is missing and drops non-https links", () => {
    const row = toRow({ ...sample, url: "http://insecure.example", _embedded: undefined }, kyoto)!;
    expect(row.city).toBe("Kyoto");
    expect(row.url).toBeNull();
    expect(row.lat).toBeNull();
  });

  it.each([
    [{ segment: { name: "Sports" } }, "sports"],
    [{ segment: { name: "Arts & Theatre" } }, "art"],
    [{ segment: { name: "Miscellaneous" }, genre: { name: "Fashion" } }, "fashion"],
    [{ segment: { name: "Miscellaneous" }, genre: { name: "Food & Drink" } }, "food"],
    [{ segment: { name: "Miscellaneous" } }, "other"],
  ])("categorises %j as %s", (c, expected) => {
    expect(categoryFor({ ...sample, name: "Event", classifications: [c] })).toBe(expected);
  });

  it("builds a search URL around the destination", () => {
    const url = new URL(searchUrl("KEY", kyoto, new Date("2026-11-07T00:00:00Z")));
    expect(url.searchParams.get("latlong")).toBe("35.01,135.77");
    expect(url.searchParams.get("startDateTime")).toBe("2026-11-07T00:00:00Z");
    expect(url.searchParams.get("endDateTime")).toBe("2027-01-06T00:00:00Z");
  });
});
