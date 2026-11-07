import { useEffect } from "react";
import { AlertCircle, Bell, Bookmark, Compass, ListChecks, Sparkles, Stamp, Map as MapIcon, Rows3 } from "lucide-react";
import { useUi, type Tab } from "../store/ui";
import { useEvents, useMe, useSaves } from "../api/hooks";
import { Avatar } from "./ui";
import { APP_NAME, cx } from "../lib/util";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="7" fill="#B8361C" />
      <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="#1B1D22" strokeWidth="2" transform="rotate(-24 16 16)" />
      <circle cx="28" cy="10.5" r="2.2" fill="#F26B4F" />
    </svg>
  );
}

/** Upcoming events at places the person saved or follows. */
export function useUpdates() {
  const { data: me } = useMe();
  const { data: saves = [] } = useSaves();
  const { data: events = [] } = useEvents();
  const places = new Set([...(me?.watching ?? []), ...saves.filter((s) => s.itemType === "destination").map((s) => s.itemId)]);
  return events.filter((e) => e.destinationId && places.has(e.destinationId));
}

export function TopBar() {
  const { data: me } = useMe();
  const user = useUi((s) => s.user);
  const open = useUi((s) => s.open);
  const setTab = useUi((s) => s.setTab);
  const tab = useUi((s) => s.tab);
  const view = useUi((s) => s.exploreView);
  const setView = useUi((s) => s.setExploreView);
  const updates = useUpdates();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-1.5 bg-bg/90 px-5 pt-4 pb-3 backdrop-blur">
      <button onClick={() => setTab("explore")} className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
        <Logo />
        <span className="font-display text-[24px] font-semibold">{APP_NAME}</span>
      </button>
      <div className="flex-1" />
      {tab === "explore" && (
        <button
          onClick={() => setView(view === "map" ? "feed" : "map")}
          aria-label={view === "map" ? "Show feed" : "Show map"}
          className="flex h-10 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-bold shadow-sm"
        >
          {view === "map" ? <Rows3 size={17} /> : <MapIcon size={17} />} {view === "map" ? "Feed" : "Map"}
        </button>
      )}
      {user && (
        <button onClick={() => open({ type: "updates" })} aria-label={`Updates, ${updates.length}`} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-card">
          <Bell size={21} />
          {updates.length > 0 && <span className="absolute top-2 right-2.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />}
        </button>
      )}
      {user && me ? (
        <button onClick={() => setTab("passport")} aria-label="Your passport" className="ml-1">
          <Avatar name={me.name || me.handle} hue={me.hue} size={36} />
        </button>
      ) : user === null ? (
        <button onClick={() => open({ type: "auth" })} className="ml-1 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-white">
          Sign in
        </button>
      ) : null}
    </header>
  );
}

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "Explore", icon: Compass },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "trips", label: "Trips", icon: ListChecks },
  { id: "passport", label: "Passport", icon: Stamp },
];

export function BottomNav() {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const { data: saves = [] } = useSaves();
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 px-4 pb-4">
      <div className="flex rounded-[28px] bg-card px-2 py-2 shadow-[0_8px_30px_rgba(20,20,30,0.12)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            aria-label={id === "saved" && saves.length ? `${label}, ${saves.length} items` : label}
            className={cx("relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition", tab === id ? "text-accent" : "text-ink/80 hover:text-ink")}
          >
            <Icon size={21} strokeWidth={tab === id ? 2.4 : 1.9} />
            <span className="text-[10.5px] font-bold tracking-wider uppercase">{label}</span>
            {id === "saved" && saves.length > 0 && (
              <span aria-hidden className="absolute top-0 right-[22%] min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-white">{saves.length}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dismiss(toasts[0].id), toasts[0].tone === "error" ? 4000 : 2400);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  const t = toasts[0];
  if (!t) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4" aria-live="polite" role="status">
      <div key={t.id} className={cx("animate-toast pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-xl", t.tone === "error" ? "bg-accent-dark" : "bg-navy")}>
        <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", t.tone === "error" ? "bg-white/15" : "bg-accent")}>
          {t.tone === "error" ? <AlertCircle size={17} /> : <Sparkles size={17} />}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold">{t.text}</div>
          {t.sub && <div className={cx("text-xs", t.tone === "xp" ? "text-[#9EE6BF]" : "text-white/75")}>{t.sub}</div>}
        </div>
      </div>
    </div>
  );
}
