import { describe, expect, it } from "vitest";
import { recommendCommunities, searchCommunities } from "../lib/communities";
import type { Community } from "../types";

const c = (p: Partial<Community> & Pick<Community, "id" | "name">): Community => ({
  slug: p.id, description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 20, official: true,
  createdBy: null, status: "published", memberCount: 0, postCount: 0, createdAt: "", ...p,
});

const all = [
  c({ id: "japan", name: "Japan Travel Club", destinationId: "kyoto", country: "Japan", memberCount: 5 }),
  c({ id: "food", name: "Food Trails", styles: ["food"], memberCount: 50 }),
  c({ id: "big", name: "Big Group", memberCount: 900 }),
  c({ id: "hidden", name: "Pending Club", status: "pending", memberCount: 999 }),
  c({ id: "iberia", name: "Iberia Wanderers", country: "Portugal", description: "Tascas and azulejos" }),
];

describe("recommendCommunities", () => {
  it("puts places you saved first, then countries you visited, then your styles", () => {
    const r = recommendCommunities(all, { me: { styles: ["food"], visited: ["Portugal"], watching: [] }, savedDestinationIds: ["kyoto"] });
    expect(r.map((x) => x.community.id).slice(0, 3)).toEqual(["japan", "iberia", "food"]);
    expect(r[0].reason).toEqual({ kind: "place", place: "" });
    expect(r[1].reason).toEqual({ kind: "country", country: "Portugal" });
  });
  it("skips joined and unpublished communities", () => {
    const r = recommendCommunities(all, { joined: ["big"] }).map((x) => x.community.id);
    expect(r).not.toContain("big");
    expect(r).not.toContain("hidden");
  });
  it("falls back to popular communities for new explorers", () => {
    expect(recommendCommunities(all, {})[0].community.id).toBe("big");
  });
});

describe("searchCommunities", () => {
  it("matches names, descriptions and countries, ignoring case and accents", () => {
    expect(searchCommunities(all, "japan").map((x) => x.id)).toEqual(["japan"]);
    expect(searchCommunities(all, "AZULÉJOS").map((x) => x.id)).toEqual(["iberia"]);
    expect(searchCommunities(all, "portugal tascas").map((x) => x.id)).toEqual(["iberia"]);
  });
});
