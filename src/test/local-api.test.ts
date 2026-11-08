import { beforeEach, describe, expect, it } from "vitest";
import { createLocalApi, resetLocalDb } from "../api/local";
import type { Api } from "../api/types";

let api: Api;
const signIn = async (email: string) => {
  await api.sendMagicLink(email);
  return (await api.getMyProfile())!;
};
const newGem = { destinationId: "lisbon", name: "Quiet Cove", description: "A sheltered swimming cove", tip: "", category: "beach" as const, styles: [], lat: 38.7, lng: -9.4, country: "Portugal" };

beforeEach(() => {
  resetLocalDb();
  api = createLocalApi();
});

describe("local demo backend", () => {
  it("creates a profile on first sign-in that still needs onboarding", async () => {
    const me = await signIn("a@example.com");
    expect(me.onboarded).toBe(false);
    await api.updateMyProfile({ handle: "alice", name: "Alice", onboarded: true, visited: ["Japan"] });
    expect((await api.getMyProfile())!.xp).toBe(115);
  });

  it("rejects taken or invalid handles", async () => {
    await signIn("a@example.com");
    await api.updateMyProfile({ handle: "alice" });
    await signIn("b@example.com");
    await expect(api.updateMyProfile({ handle: "alice" })).rejects.toThrow(/taken/);
    await expect(api.updateMyProfile({ handle: "No Spaces" })).rejects.toThrow(/Handles/);
  });

  it("returns copies so callers can detect changes", async () => {
    await signIn("a@example.com");
    const before = await api.getMyProfile();
    await api.updateMyProfile({ name: "Changed" });
    expect(before!.name).toBe("");
  });

  it("publishes clean gems, holds ones with links, and awards XP once", async () => {
    await signIn("a@example.com");
    const ok = await api.createGem(newGem, []);
    const held = await api.createGem({ ...newGem, name: "Promo", description: "Visit https://spam.example now" }, []);
    expect(ok.status).toBe("published");
    expect(held.status).toBe("pending");
    expect((await api.getMyProfile())!.xp).toBe(50);
  });

  it("saves award XP once per item even when toggled", async () => {
    await signIn("a@example.com");
    await api.setSaved("destination", "kyoto", true);
    await api.setSaved("destination", "kyoto", false);
    await api.setSaved("destination", "kyoto", true);
    expect(await api.listSaves()).toHaveLength(1);
    expect((await api.getMyProfile())!.xp).toBe(5);
  });

  it("hides a gem after three reports and lets a moderator restore it", async () => {
    await signIn("author@example.com");
    const g = await api.createGem(newGem, []);
    for (const who of ["r1", "r2", "r3"]) {
      await signIn(`${who}@example.com`);
      await api.report("gem", g.id, "spam", "");
    }
    await signIn("viewer@example.com");
    await api.updateMyProfile({ handle: "viewer" });
    // Demo accounts are moderators, so check the raw status through the queue instead.
    const queue = await api.moderationQueue();
    expect(queue.gems.find((x) => x.id === g.id)?.status).toBe("hidden");
    expect(queue.reports).toHaveLength(3);
    await api.moderate("gem", g.id, "published", "");
    expect((await api.moderationQueue()).reports).toHaveLength(0);
    expect((await api.getGem(g.id))!.status).toBe("published");
  });

  it("does not allow upvoting your own gem or reporting twice", async () => {
    await signIn("a@example.com");
    const g = await api.createGem(newGem, []);
    await expect(api.setUpvote(g.id, true)).rejects.toThrow(/own gem/);
    await signIn("b@example.com");
    await api.report("gem", g.id, "spam", "");
    await expect(api.report("gem", g.id, "spam", "")).rejects.toThrow(/already/);
  });

  it("builds trips from saved items and awards a check-in once", async () => {
    await signIn("a@example.com");
    const t = await api.createTrip({ destinationId: "kyoto", title: "Kyoto", style: "culture", startDate: "2026-11-20", days: 3 });
    await api.addTripItems([{ tripId: t.id, day: 0, time: null, title: "Otagi", notes: "", itemType: "gem", itemId: "gem-otagi" }]);
    const [item] = await api.listTripItems(t.id);
    await api.updateTripItem(item.id, { done: true });
    await api.updateTripItem(item.id, { done: false });
    await api.updateTripItem(item.id, { done: true });
    expect((await api.getMyProfile())!.xp).toBe(60 + 15);
  });

  it("keeps trips private to their owner", async () => {
    await signIn("a@example.com");
    const t = await api.createTrip({ destinationId: null, title: "Mine", style: "custom", startDate: null, days: 1 });
    await signIn("b@example.com");
    expect(await api.listTrips()).toHaveLength(0);
    await expect(api.addTripItems([{ tripId: t.id, day: 0, time: null, title: "x", notes: "", itemType: null, itemId: null }])).rejects.toThrow(/permission/);
  });

  it("blocking hides the other person's gems", async () => {
    const author = await signIn("a@example.com");
    const g = await api.createGem(newGem, []);
    await signIn("b@example.com");
    await api.setBlock(author.id, true);
    // Demo accounts are moderators (who see everything), so demote this one for the check.
    const raw = JSON.parse(localStorage.getItem("orbis-local-db-v1")!);
    raw.profiles.find((p: { id: string }) => p.id === raw.currentUserId).role = "member";
    localStorage.setItem("orbis-local-db-v1", JSON.stringify(raw));
    api = createLocalApi();
    expect((await api.listGems()).some((x) => x.id === g.id)).toBe(false);
  });

  it("ignores attempts to change role or XP", async () => {
    await signIn("a@example.com");
    await api.updateMyProfile({ role: "admin", xp: 99999 } as never);
    const me = (await api.getMyProfile())!;
    expect(me.xp).toBe(0);
    expect(me.role).toBe("moderator"); // demo default, unchanged
  });

  it("deleting an account removes the person's data", async () => {
    await signIn("a@example.com");
    await api.createGem(newGem, []);
    await api.setSaved("destination", "kyoto", true);
    await api.deleteAccount();
    expect(await api.getUser()).toBeNull();
    expect((await api.listGems()).some((g) => g.name === "Quiet Cove")).toBe(false);
  });
});
