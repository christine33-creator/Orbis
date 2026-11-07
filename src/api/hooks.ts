import { useEffect, useState } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./index";
import type { NewTrip } from "./types";
import type { AuthUser, ContentStatus, ItemType, NewGem, NewTripItem, ProfilePatch, ReportReason, ReportTarget, TripItem } from "../types";
import { useUi } from "../store/ui";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

export const keys = {
  me: ["me"] as const,
  destinations: ["destinations"] as const,
  gems: ["gems"] as const,
  events: ["events"] as const,
  saves: ["saves"] as const,
  upvotes: ["upvotes"] as const,
  tips: (d: string) => ["tips", d] as const,
  tipVotes: ["tipVotes"] as const,
  trips: ["trips"] as const,
  items: (t: string) => ["items", t] as const,
  following: ["following"] as const,
  blocks: ["blocks"] as const,
  profile: (id: string) => ["profile", id] as const,
  followCounts: (id: string) => ["followCounts", id] as const,
  xp: ["xp"] as const,
  modQueue: ["modQueue"] as const,
};

/** Current auth user; `undefined` while the session is being restored. */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.getUser().then((u) => alive && setUser(u));
    const off = api.onAuthChange((u) => {
      setUser(u);
      queryClient.invalidateQueries();
    });
    return () => {
      alive = false;
      off();
    };
  }, []);
  return user;
}

const useToastError = () => {
  const toast = useUi((s) => s.toast);
  return (e: unknown) => toast({ text: e instanceof Error ? e.message : "Something went wrong.", tone: "error" });
};

// Queries ------------------------------------------------------------------------------
export const useMe = () => useQuery({ queryKey: keys.me, queryFn: api.getMyProfile });
export const useDestinations = () => useQuery({ queryKey: keys.destinations, queryFn: api.listDestinations, staleTime: 3600_000 });
export const useGems = () => useQuery({ queryKey: keys.gems, queryFn: api.listGems });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: api.listEvents });
export const useSaves = () => useQuery({ queryKey: keys.saves, queryFn: api.listSaves });
export const useUpvotes = () => useQuery({ queryKey: keys.upvotes, queryFn: api.myUpvotes });
export const useTips = (destinationId: string) => useQuery({ queryKey: keys.tips(destinationId), queryFn: () => api.listTips(destinationId) });
export const useTipVotes = () => useQuery({ queryKey: keys.tipVotes, queryFn: api.myTipVotes });
export const useTrips = () => useQuery({ queryKey: keys.trips, queryFn: api.listTrips });
export const useTripItems = (tripId: string | null) =>
  useQuery({ queryKey: keys.items(tripId ?? ""), queryFn: () => api.listTripItems(tripId!), enabled: !!tripId });
export const useFollowing = () => useQuery({ queryKey: keys.following, queryFn: api.listFollowing });
export const useBlocks = () => useQuery({ queryKey: keys.blocks, queryFn: api.listBlocks });
export const useProfile = (id: string) => useQuery({ queryKey: keys.profile(id), queryFn: () => api.getProfile(id) });
export const useFollowCounts = (id: string) => useQuery({ queryKey: keys.followCounts(id), queryFn: () => api.followCounts(id) });
export const useXpHistory = () => useQuery({ queryKey: keys.xp, queryFn: api.xpHistory });
export const useModQueue = (enabled: boolean) => useQuery({ queryKey: keys.modQueue, queryFn: api.moderationQueue, enabled });

// Lookups -------------------------------------------------------------------------------
export function useDestination(id: string | null | undefined) {
  const { data } = useDestinations();
  return id ? data?.find((d) => d.id === id) : undefined;
}

export function useIsSaved() {
  const { data } = useSaves();
  return (type: ItemType, id: string) => !!data?.some((s) => s.itemType === type && s.itemId === id);
}

// Mutations -----------------------------------------------------------------------------
/** XP is granted by the backend, so refresh the profile after anything that might earn it. */
const refreshMe = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: keys.me });
  qc.invalidateQueries({ queryKey: keys.xp });
};

export function useUpdateProfile() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (p: ProfilePatch) => api.updateMyProfile(p),
    onSuccess: (p) => {
      qc.setQueryData(keys.me, p);
      refreshMe(qc);
    },
    onError,
  });
}

export function useToggleSave() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ type, id, on }: { type: ItemType; id: string; on: boolean }) => api.setSaved(type, id, on),
    onMutate: async ({ type, id, on }) => {
      await qc.cancelQueries({ queryKey: keys.saves });
      const prev = qc.getQueryData(keys.saves);
      qc.setQueryData(keys.saves, (old: { itemType: ItemType; itemId: string; createdAt: string }[] = []) =>
        on ? [{ itemType: type, itemId: id, createdAt: new Date().toISOString() }, ...old] : old.filter((s) => !(s.itemType === type && s.itemId === id)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.saves, ctx?.prev);
      onError(e);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.saves });
      qc.invalidateQueries({ queryKey: keys.gems });
      refreshMe(qc);
    },
  });
}

export function useToggleUpvote() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.setUpvote(id, on),
    onMutate: async ({ id, on }) => {
      const prev = qc.getQueryData<string[]>(keys.upvotes);
      qc.setQueryData(keys.upvotes, (old: string[] = []) => (on ? [...old, id] : old.filter((x) => x !== id)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.upvotes, ctx?.prev);
      onError(e);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.upvotes });
      qc.invalidateQueries({ queryKey: keys.gems });
    },
  });
}

export function useCreateGem() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ gem, photos }: { gem: NewGem; photos: Blob[] }) => api.createGem(gem, photos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.gems });
      refreshMe(qc);
    },
    onError,
  });
}

export function useDeleteGem() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({ mutationFn: api.deleteGem, onSuccess: () => qc.invalidateQueries({ queryKey: keys.gems }), onError });
}

export function useCreateTip(destinationId: string) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ category, body }: { category: string; body: string }) => api.createTip(destinationId, category, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tips(destinationId) });
      refreshMe(qc);
    },
    onError,
  });
}

export function useToggleTipVote(destinationId: string) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.setTipVote(id, on),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.tipVotes });
      qc.invalidateQueries({ queryKey: keys.tips(destinationId) });
    },
    onError,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: async ({ trip, items }: { trip: NewTrip; items?: Omit<NewTripItem, "tripId">[] }) => {
      const t = await api.createTrip(trip);
      if (items?.length) await api.addTripItems(items.map((i) => ({ ...i, tripId: t.id })));
      return t;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.trips });
      refreshMe(qc);
    },
    onError,
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateTrip>[1] }) => api.updateTrip(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.trips }),
    onError,
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({ mutationFn: api.deleteTrip, onSuccess: () => qc.invalidateQueries({ queryKey: keys.trips }), onError });
}

export function useTripItemMutations(tripId: string) {
  const qc = useQueryClient();
  const onError = useToastError();
  const settle = () => qc.invalidateQueries({ queryKey: keys.items(tripId) });
  const add = useMutation({
    mutationFn: (items: Omit<NewTripItem, "tripId">[]) => api.addTripItems(items.map((i) => ({ ...i, tripId }))),
    onSettled: settle,
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<TripItem, "day" | "position" | "time" | "title" | "notes" | "done">> }) => api.updateTripItem(id, patch),
    onMutate: async ({ id, patch }) => {
      qc.setQueryData(keys.items(tripId), (old: TripItem[] = []) => old.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    onSettled: () => {
      settle();
      refreshMe(qc);
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: api.deleteTripItem,
    onMutate: async (id: string) => {
      qc.setQueryData(keys.items(tripId), (old: TripItem[] = []) => old.filter((i) => i.id !== id));
    },
    onSettled: settle,
    onError,
  });
  return { add, update, remove };
}

/** Adds a saved item to a trip; used from detail pages and the Saved tab. */
export function useAddToTrip() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (item: NewTripItem) => api.addTripItems([item]),
    onSuccess: (_d, item) => qc.invalidateQueries({ queryKey: keys.items(item.tripId) }),
    onError,
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.setFollow(id, on),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: keys.following });
      qc.invalidateQueries({ queryKey: keys.followCounts(v.id) });
      refreshMe(qc);
    },
    onError,
  });
}

export function useToggleBlock() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.setBlock(id, on),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.blocks });
      qc.invalidateQueries({ queryKey: keys.following });
      qc.invalidateQueries({ queryKey: keys.gems });
    },
    onError,
  });
}

export function useReport() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (r: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string }) =>
      api.report(r.targetType, r.targetId, r.reason, r.details),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.gems }),
    onError,
  });
}

export function useModerate() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ type, id, status, note }: { type: "gem" | "tip"; id: string; status: ContentStatus; note: string }) => api.moderate(type, id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.modQueue });
      qc.invalidateQueries({ queryKey: keys.gems });
    },
    onError,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "resolved" | "dismissed" }) => api.resolveReport(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.modQueue }),
    onError,
  });
}
