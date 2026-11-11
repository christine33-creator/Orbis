import { beforeEach, describe, expect, it } from "vitest";
import { createLocalApi, resetLocalDb } from "../api/local";
import type { Api } from "../api/types";

let api: Api;
const signIn = async (email: string) => {
  await api.sendMagicLink(email);
  return (await api.getMyProfile())!;
};
const post = (communityId: string, title = "Best tacos in Oaxaca") => ({
  communityId, kind: "recommendation" as const, title, body: "Pick your own meat in the smoke hall.", destinationId: "oaxaca", place: "Mercado 20 de Noviembre",
});

beforeEach(() => {
  resetLocalDb();
  api = createLocalApi();
});

describe("community in the demo backend", () => {
  it("lists the official starter communities", async () => {
    const all = await api.listCommunities();
    expect(all.filter((c) => c.official)).toHaveLength(9);
  });

  it("creates a community with its creator as owner, who cannot leave", async () => {
    await signIn("o@example.com");
    const c = await api.createCommunity({ name: "Night Market Crew", description: "Street food after dark", category: "interest", destinationId: null, country: "", styles: ["food"], hue: 20 });
    expect(c.slug).toBe("night-market-crew");
    expect((await api.myMemberships())[0]).toMatchObject({ communityId: c.id, role: "owner" });
    await expect(api.setMembership(c.id, false)).rejects.toThrow("ownerCannotLeave");
    await expect(api.createCommunity({ name: "night market crew", description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 20 })).rejects.toThrow("communityNameTaken");
  });

  it("requires membership to post and comment, and counts likes, comments and saves", async () => {
    const owner = await signIn("o@example.com");
    const c = await api.createCommunity({ name: "Night Market Crew", description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 20 });
    const p = await api.createPost(post(c.id), []);
    expect(p.status).toBe("published");

    await signIn("v@example.com");
    await expect(api.createComment(p.id, "Thanks!")).rejects.toThrow("joinFirst");
    await expect(api.createPost(post(c.id, "Me too"), [])).rejects.toThrow("joinFirst");
    await api.setMembership(c.id, true);
    await api.createComment(p.id, "Thanks!");
    await api.setLike(p.id, true);
    await api.setPostSaved(p.id, true);
    const after = (await api.getPost(p.id))!;
    expect([after.likes, after.comments, after.saves]).toEqual([1, 1, 1]);
    expect(await api.mySavedPosts()).toEqual([p.id]);
    await expect(api.updatePost(p.id, { body: "hijacked" })).rejects.toThrow("permission");
    expect((await api.getCommunity(c.id))!.memberCount).toBe(2);

    await signIn("o@example.com");
    await expect(api.setLike(p.id, true)).rejects.toThrow("ownPost");
    expect((await api.profileStats(owner.id))!.posts).toBe(1);
  });

  it("holds posts with contact details for review", async () => {
    await signIn("o@example.com");
    const c = await api.createCommunity({ name: "Deals", description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 20 });
    const p = await api.createPost({ ...post(c.id), body: "Call +1 555 123 4567 for a tour" }, []);
    expect(p.status).toBe("pending");
  });

  // In the demo every account is also a site moderator (so the queue can be tried), so the
  // owner-only rule is covered by the database tests instead.
  it("owners promote moderators, and hidden posts leave the post count", async () => {
    await signIn("o@example.com");
    const c = await api.createCommunity({ name: "Night Market Crew", description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 20 });
    const mod = await signIn("m@example.com");
    await api.setMembership(c.id, true);
    const p = await api.createPost(post(c.id), []);
    await signIn("o@example.com");
    await api.setMemberRole(c.id, mod.id, "moderator");
    expect((await api.listMembers(c.id)).map((m) => m.role)).toEqual(["owner", "moderator"]);
    await api.moderate("post", p.id, "hidden", "");
    expect((await api.getCommunity(c.id))!.postCount).toBe(0);
  });

  it("sends recommendations to review before they reach Explore", async () => {
    await signIn("o@example.com");
    const c = await api.createCommunity({ name: "Night Market Crew", description: "", category: "interest", destinationId: null, country: "", styles: [], hue: 20 });
    const p = await api.createPost(post(c.id), []);
    const gem = await api.createGem({ destinationId: "oaxaca", name: "Pasillo de Humo", description: "Smoky grill hall in the market", tip: "", category: "food", styles: [], lat: 17.06, lng: -96.72, country: "Mexico", sourcePostId: p.id }, []);
    expect(gem.status).toBe("pending");
    expect((await api.gemFromPost(p.id))!.id).toBe(gem.id);
    await signIn("x@example.com");
    await expect(api.createGem({ destinationId: null, name: "Stolen", description: "Someone else's post", tip: "", category: "food", styles: [], lat: 1, lng: 1, country: "", sourcePostId: p.id }, [])).rejects.toThrow("notYourRecommendation");
  });

  it("hides private members and their follow lists", async () => {
    const pub = await signIn("p@example.com");
    const priv = await signIn("q@example.com");
    await api.updateMyProfile({ visibility: "private" });
    await api.setMembership("community-solo-explorers", true);
    await signIn("p@example.com");
    await api.setMembership("community-solo-explorers", true);
    const members = await api.listMembers("community-solo-explorers");
    expect(members.map((m) => m.id)).toContain(pub.id);
    expect(members.map((m) => m.id)).not.toContain(priv.id);
  });
});
