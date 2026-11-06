import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Destination, FieldNote, GroupExpedition, Profile, SocialLinks, Stop, Trip, TripStyle, Visibility, XpEvent } from "../types";
import { XP, levelFor } from "../lib/progress";
import { addDays, uid } from "../lib/util";
import { buildTrip } from "../data/activities";
import { destinationById } from "../data/destinations";

export type Tab = "explore" | "groups" | "itinerary" | "passport";

export type Overlay =
  | { type: "map"; focus?: string }
  | { type: "destination"; id: string }
  | { type: "traveler"; id: string }
  | { type: "group"; id: string }
  | { type: "notifications" }
  | { type: "newTrip"; destinationId?: string }
  | { type: "newGroup"; destinationId?: string }
  | { type: "shareGem" }
  | { type: "addTip"; destinationId: string }
  | { type: "addStop" }
  | { type: "editProfile" }
  | { type: "xpLog" };

export interface Toast {
  id: string;
  text: string;
  xp?: number;
  levelUp?: number;
}

interface State {
  profile: Profile | null;
  xp: number;
  xpLog: XpEvent[];
  tab: Tab;
  overlays: Overlay[];
  following: string[];
  connections: string[];
  savedGems: string[];
  upvoted: string[];
  sharedGems: Destination[];
  notes: FieldNote[];
  trips: Trip[];
  activeTripId: string | null;
  activeDay: number;
  groups: GroupExpedition[];
  joinedGroups: string[];
  privacy: { visibility: Visibility; companionMatching: boolean; beacon: boolean };
  readNews: string[];
  toasts: Toast[];

  // navigation
  setTab: (t: Tab) => void;
  open: (o: Overlay) => void;
  close: () => void;
  closeAll: () => void;

  // engagement
  award: (amount: number, label: string) => void;
  dismissToast: (id: string) => void;

  completeOnboarding: (p: Profile, firstTrip?: { destinationId: string; style: TripStyle; start: string; days: number }) => void;
  updateProfile: (p: Partial<Profile>) => void;
  setSocials: (s: SocialLinks) => void;
  toggleVisited: (country: string) => void;
  toggleWatch: (destinationId: string) => void;
  toggleFollow: (id: string) => void;
  connect: (id: string) => void;
  toggleSaveGem: (id: string) => void;
  toggleUpvote: (id: string) => void;
  shareGem: (d: Destination) => void;
  addNote: (n: Omit<FieldNote, "id" | "votes" | "mine">) => void;

  createTrip: (destinationId: string, style: TripStyle, start: string, days: number, title?: string) => void;
  setActiveTrip: (id: string) => void;
  setActiveDay: (i: number) => void;
  toggleStopDone: (stopId: string) => void;
  addStop: (stop: Omit<Stop, "id">) => void;
  removeStop: (stopId: string) => void;
  regenerateDay: () => void;
  deleteTrip: (id: string) => void;

  joinGroup: (id: string) => void;
  leaveGroup: (id: string) => void;
  createGroup: (g: Omit<GroupExpedition, "id" | "memberIds" | "leaderId" | "createdByMe">) => void;

  setPrivacy: (p: Partial<State["privacy"]>) => void;
  markNewsRead: (ids: string[]) => void;
  reset: () => void;
}

const initial = {
  profile: null,
  xp: 0,
  xpLog: [],
  tab: "explore" as Tab,
  overlays: [],
  following: [],
  connections: [],
  savedGems: [],
  upvoted: [],
  sharedGems: [],
  notes: [],
  trips: [],
  activeTripId: null,
  activeDay: 0,
  groups: [],
  joinedGroups: [],
  privacy: { visibility: "verified" as Visibility, companionMatching: true, beacon: true },
  readNews: [],
  toasts: [],
};

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export const useApp = create<State>()(
  persist(
    (set, get) => {
      const mutateTrip = (fn: (t: Trip) => Trip) =>
        set((s) => ({ trips: s.trips.map((t) => (t.id === s.activeTripId ? fn(t) : t)) }));
      const mutateDay = (fn: (stops: Stop[]) => Stop[]) =>
        mutateTrip((t) => ({
          ...t,
          days: t.days.map((d, i) => (i === get().activeDay ? { ...d, stops: fn(d.stops) } : d)),
        }));

      return {
        ...initial,

        setTab: (tab) => set({ tab, overlays: [] }),
        open: (o) => set((s) => ({ overlays: [...s.overlays, o] })),
        close: () => set((s) => ({ overlays: s.overlays.slice(0, -1) })),
        closeAll: () => set({ overlays: [] }),

        award: (amount, label) => {
          const before = levelFor(get().xp).level;
          const xp = get().xp + amount;
          const after = levelFor(xp).level;
          const event: XpEvent = { id: uid(), label, amount, at: Date.now() };
          set((s) => ({
            xp,
            xpLog: [event, ...s.xpLog].slice(0, 100),
            // Show only the latest reward so toasts never lag behind the action.
            toasts: [{ id: event.id, text: label, xp: amount, levelUp: after > before ? after : undefined }],
          }));
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        completeOnboarding: (profile, firstTrip) => {
          set({ profile, tab: "explore" });
          const socials = Object.values(profile.socials).filter(Boolean).length;
          get().award(XP.completeProfile + profile.visited.length * XP.addVisitedCountry + socials * XP.connectSocial, "Profile created");
          if (firstTrip) {
            const d = destinationById(firstTrip.destinationId);
            if (d) {
              const trip = buildTrip(d, firstTrip.style, firstTrip.start, firstTrip.days);
              set((s) => ({ trips: [trip, ...s.trips], activeTripId: trip.id, activeDay: 0 }));
            }
          }
        },
        updateProfile: (p) => set((s) => ({ profile: s.profile ? { ...s.profile, ...p } : s.profile })),
        setSocials: (socials) => {
          const prev = get().profile?.socials ?? {};
          const added = (Object.keys(socials) as (keyof SocialLinks)[]).filter((k) => socials[k] && !prev[k]).length;
          get().updateProfile({ socials });
          if (added) get().award(XP.connectSocial * added, "Social portal connected");
        },
        toggleVisited: (country) => {
          const p = get().profile;
          if (!p) return;
          const adding = !p.visited.includes(country);
          get().updateProfile({ visited: toggle(p.visited, country) });
          if (adding) get().award(XP.addVisitedCountry, `Stamped ${country}`);
        },
        toggleWatch: (id) => {
          const p = get().profile;
          if (!p) return;
          const adding = !p.watching.includes(id);
          get().updateProfile({ watching: toggle(p.watching, id) });
          if (adding) get().award(XP.watchDestination, "Destination added to radar");
        },
        toggleFollow: (id) => {
          const adding = !get().following.includes(id);
          set((s) => ({ following: toggle(s.following, id) }));
          if (adding) get().award(XP.follow, "Followed a traveller");
        },
        connect: (id) => {
          if (get().connections.includes(id)) return;
          set((s) => ({ connections: [...s.connections, id] }));
          get().award(XP.connect, "Companion request sent");
        },
        toggleSaveGem: (id) => {
          const adding = !get().savedGems.includes(id);
          set((s) => ({ savedGems: toggle(s.savedGems, id) }));
          if (adding) get().award(XP.saveGem, "Gem saved");
        },
        toggleUpvote: (id) => {
          const adding = !get().upvoted.includes(id);
          set((s) => ({ upvoted: toggle(s.upvoted, id) }));
          if (adding) get().award(XP.upvote, "Upvoted");
        },
        shareGem: (d) => {
          set((s) => ({ sharedGems: [d, ...s.sharedGems] }));
          get().award(XP.shareGem, `Shared ${d.name}`);
        },
        addNote: (n) => {
          set((s) => ({ notes: [{ ...n, id: uid(), votes: 0, mine: true }, ...s.notes] }));
          get().award(XP.submitTip, "Field note published");
        },

        createTrip: (destinationId, style, start, days, title) => {
          const d = destinationById(destinationId);
          if (!d) return;
          const trip = buildTrip(d, style, start, days, title);
          set((s) => ({ trips: [trip, ...s.trips], activeTripId: trip.id, activeDay: 0, tab: "itinerary", overlays: [] }));
          get().award(XP.createTrip, "Itinerary created");
        },
        setActiveTrip: (id) => set({ activeTripId: id, activeDay: 0 }),
        setActiveDay: (activeDay) => set({ activeDay }),
        toggleStopDone: (stopId) => {
          const trip = get().trips.find((t) => t.id === get().activeTripId);
          const stop = trip?.days[get().activeDay]?.stops.find((x) => x.id === stopId);
          mutateDay((stops) => stops.map((x) => (x.id === stopId ? { ...x, done: !x.done } : x)));
          if (stop && !stop.done) get().award(XP.completeStop, `Checked in: ${stop.title}`);
        },
        addStop: (stop) =>
          mutateDay((stops) => [...stops, { ...stop, id: uid() }].sort((a, b) => a.time.localeCompare(b.time))),
        removeStop: (stopId) => mutateDay((stops) => stops.filter((x) => x.id !== stopId)),
        regenerateDay: () => {
          const trip = get().trips.find((t) => t.id === get().activeTripId);
          const d = trip && destinationById(trip.destinationId);
          if (!trip || !d) return;
          // Re-roll using a rotated slice of a longer generated plan so the day changes.
          const fresh = buildTrip(d, trip.style, trip.startDate, trip.days.length + 3).days;
          const pick = fresh[(get().activeDay + 1 + Math.floor(Math.random() * 3)) % fresh.length];
          mutateTrip((t) => ({
            ...t,
            days: t.days.map((day, i) => (i === get().activeDay ? { ...day, stops: pick.stops } : day)),
          }));
        },
        deleteTrip: (id) =>
          set((s) => {
            const trips = s.trips.filter((t) => t.id !== id);
            return { trips, activeTripId: s.activeTripId === id ? (trips[0]?.id ?? null) : s.activeTripId, activeDay: 0 };
          }),

        joinGroup: (id) => {
          if (get().joinedGroups.includes(id)) return;
          set((s) => ({ joinedGroups: [...s.joinedGroups, id] }));
          get().award(XP.joinGroup, "Joined a group expedition");
        },
        leaveGroup: (id) => set((s) => ({ joinedGroups: s.joinedGroups.filter((g) => g !== id) })),
        createGroup: (g) => {
          const group: GroupExpedition = { ...g, id: uid(), memberIds: [], leaderId: "me", createdByMe: true };
          set((s) => ({ groups: [group, ...s.groups], joinedGroups: [...s.joinedGroups, group.id], overlays: [] }));
          get().award(XP.createGroup, "Group expedition created");
        },

        setPrivacy: (p) => set((s) => ({ privacy: { ...s.privacy, ...p } })),
        markNewsRead: (ids) => set((s) => ({ readNews: Array.from(new Set([...s.readNews, ...ids])) })),
        reset: () => set({ ...initial }),
      };
    },
    {
      name: "solis-state-v1",
      partialize: ({ toasts: _t, overlays: _o, ...rest }) => rest,
    },
  ),
);

export const useActiveTrip = () =>
  useApp((s) => s.trips.find((t) => t.id === s.activeTripId) ?? s.trips[0] ?? null);

/** A ready-made profile so people can explore the app without onboarding. */
export function demoSeed(start: string) {
  const profile: Profile = {
    name: "Sophia Thorne",
    handle: "sophiatravels",
    home: "Kyoto, Japan",
    bio: "Alps enthusiast, specialty coffee hunter & architectural photographer. Always looking for unmapped trails.",
    hue: 20,
    styles: ["culture", "photography", "adventure", "food", "eco"],
    preferences: { pace: "balanced", budget: "comfort", company: "duo" },
    visited: ["Japan", "Italy", "Chile", "Iceland", "Portugal", "Spain", "France", "Norway", "Georgia", "Mexico", "Morocco", "Vietnam", "Albania", "Switzerland"],
    watching: ["kyoto", "lisbon", "svaneti", "patagonia"],
    socials: { instagram: "sophia.lens", x: "sophiathorne", strava: "sophia.hikes" },
  };
  return { profile, firstTrip: { destinationId: "kyoto", style: "culture" as TripStyle, start: addDays(start, 10), days: 7 } };
}
