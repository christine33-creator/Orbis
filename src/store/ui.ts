import { create } from "zustand";
import type { AuthUser, ItemType, ReportTarget } from "../types";

export interface TripSeedItem {
  itemType: ItemType;
  itemId: string;
  title: string;
}

export type Tab = "explore" | "saved" | "trips" | "passport";

export type Overlay =
  | { type: "destination"; id: string }
  | { type: "gem"; id: string }
  | { type: "event"; id: string }
  | { type: "profile"; id: string }
  | { type: "shareGem"; destinationId?: string }
  | { type: "newTrip"; destinationId?: string; items?: TripSeedItem[] }
  | { type: "addToTrip"; itemType: ItemType; itemId: string; title: string; destinationId?: string | null }
  | { type: "report"; targetType: ReportTarget; targetId: string; label: string; authorId?: string }
  | { type: "addTip"; destinationId: string }
  | { type: "addStop"; tripId: string; day: number }
  | { type: "editProfile" }
  | { type: "settings" }
  | { type: "moderation" }
  | { type: "xpLog" }
  | { type: "updates" }
  | { type: "guidelines" }
  | { type: "auth"; reason?: string };

export interface Toast {
  id: number;
  text: string;
  sub?: string;
  tone?: "xp" | "error" | "info";
}

interface UiState {
  /** undefined while the session is being restored */
  user: AuthUser | null | undefined;
  setUser: (u: AuthUser | null | undefined) => void;
  tab: Tab;
  overlays: Overlay[];
  toasts: Toast[];
  activeTripId: string | null;
  exploreView: "feed" | "map";
  setTab: (t: Tab) => void;
  open: (o: Overlay) => void;
  close: () => void;
  closeAll: () => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  setActiveTrip: (id: string | null) => void;
  setExploreView: (v: "feed" | "map") => void;
}

let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  user: undefined,
  setUser: (user) => set({ user }),
  tab: "explore",
  overlays: [],
  toasts: [],
  activeTripId: null,
  exploreView: "feed",
  setTab: (tab) => set({ tab, overlays: [] }),
  open: (o) => set((s) => ({ overlays: [...s.overlays, o] })),
  close: () => set((s) => ({ overlays: s.overlays.slice(0, -1) })),
  closeAll: () => set({ overlays: [] }),
  // Show only the newest toast so feedback never lags behind the action.
  toast: (t) => set({ toasts: [{ ...t, id: ++toastId }] }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setActiveTrip: (activeTripId) => set({ activeTripId }),
  setExploreView: (exploreView) => set({ exploreView }),
}));
