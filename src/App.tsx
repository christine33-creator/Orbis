import { lazy, Suspense, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, useAuthUser, useMe } from "./api/hooks";
import { api } from "./api";
import { useUi } from "./store/ui";
import { BottomNav, Toasts, TopBar } from "./components/Chrome";
import { Onboarding } from "./screens/Onboarding";
import { Explore } from "./screens/Explore";
import { Saved } from "./screens/Saved";
import { Trips } from "./screens/Trips";
import { Passport } from "./screens/Passport";
import { Overlays } from "./screens/Overlays";
import { XP_LABELS } from "./lib/rules";
import { Logo } from "./components/Chrome";

const ExploreMap = lazy(() => import("./screens/ExploreMap"));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}

function Shell() {
  const user = useAuthUser();
  const setUser = useUi((s) => s.setUser);
  const { data: me, isLoading: meLoading } = useMe();
  const tab = useUi((s) => s.tab);
  const exploreView = useUi((s) => s.exploreView);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => setUser(user), [user, setUser]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);
  useXpToasts(me?.xp);

  if (user === undefined || (user && meLoading)) {
    return (
      <Frame>
        <div className="grid h-full place-items-center"><Logo size={44} /></div>
      </Frame>
    );
  }

  if (user && me && !me.onboarded) {
    return (
      <Frame>
        <Onboarding profile={me} />
        <Toasts />
      </Frame>
    );
  }

  const mapMode = tab === "explore" && exploreView === "map";
  return (
    <Frame>
      {mapMode ? (
        <div className="flex flex-1 flex-col">
          <TopBar />
          <Suspense fallback={<div className="flex-1" />}>
            <ExploreMap />
          </Suspense>
        </div>
      ) : (
        <div id="app-scroll" ref={scroller} className="no-scrollbar flex-1 overflow-y-auto pb-28">
          <TopBar />
          <main className="px-5">
            {tab === "explore" && <Explore />}
            {tab === "saved" && <Saved />}
            {tab === "trips" && <Trips />}
            {tab === "passport" && <Passport />}
          </main>
        </div>
      )}
      <BottomNav />
      <Overlays />
      <Toasts />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full justify-center">
      <div className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-bg sm:shadow-2xl">
        {api.mode === "local" && <DemoBanner />}
        {children}
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="bg-navy px-4 py-1.5 text-center text-[11px] font-semibold text-white/80">
      Demo mode · data stays on this device
    </div>
  );
}

/** XP is granted by the server; when it rises, show what it was for. */
function useXpToasts(xp: number | undefined) {
  const prev = useRef<number | undefined>(undefined);
  const toast = useUi((s) => s.toast);
  useEffect(() => {
    if (xp === undefined) return;
    const before = prev.current;
    prev.current = xp;
    if (before === undefined || xp <= before) return;
    const gained = xp - before;
    api.xpHistory().then((h) => {
      const label = XP_LABELS[h[0]?.reason ?? ""] ?? "Explorer points earned";
      toast({ text: label, sub: `+${gained} explorer points`, tone: "xp" });
    }).catch(() => undefined);
  }, [xp, toast]);
}
