import { useEffect, useRef } from "react";
import { useApp } from "./store/useApp";
import { BottomNav, Toasts, TopBar } from "./components/Chrome";
import { Onboarding } from "./screens/Onboarding";
import { Explore } from "./screens/Explore";
import { Groups } from "./screens/Groups";
import { Itinerary } from "./screens/Itinerary";
import { Passport } from "./screens/Passport";
import { Overlays } from "./screens/Overlays";

export function App() {
  const profile = useApp((s) => s.profile);
  const tab = useApp((s) => s.tab);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="flex h-full justify-center">
      {/* Phone-width app shell; fills the screen on mobile. */}
      <div className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-bg sm:my-0 sm:shadow-2xl">
        {!profile ? (
          <Onboarding />
        ) : (
          <>
            <div id="app-scroll" ref={scroller} className="no-scrollbar flex-1 overflow-y-auto pb-28">
              <TopBar />
              <main className="px-5">
                {tab === "explore" && <Explore />}
                {tab === "groups" && <Groups />}
                {tab === "itinerary" && <Itinerary />}
                {tab === "passport" && <Passport />}
              </main>
            </div>
            <BottomNav />
            <Overlays />
          </>
        )}
        <Toasts />
      </div>
    </div>
  );
}
