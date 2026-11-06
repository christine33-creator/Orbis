import { useEffect } from "react";
import { Bell, Compass, ListChecks, Stamp, Users, Sparkles } from "lucide-react";
import { useApp, type Tab } from "../store/useApp";
import { Avatar } from "./ui";
import { APP_NAME, cx } from "../lib/util";
import { NEWS } from "../data/community";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="7" fill="#B8361C" />
      <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="#1B1D22" strokeWidth="2" transform="rotate(-24 16 16)" />
      <circle cx="28" cy="10.5" r="2.2" fill="#F26B4F" />
    </svg>
  );
}

export function TopBar() {
  const profile = useApp((s) => s.profile);
  const open = useApp((s) => s.open);
  const setTab = useApp((s) => s.setTab);
  const readNews = useApp((s) => s.readNews);
  const unread = NEWS.filter((n) => profile?.watching.includes(n.destinationId) && !readNews.includes(n.id)).length;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-bg/90 px-5 pt-4 pb-3 backdrop-blur">
      <button onClick={() => setTab("explore")} className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
        <Logo />
        <span className="font-display text-[24px] font-semibold">{APP_NAME}</span>
      </button>
      <div className="flex-1" />
      <button onClick={() => open({ type: "map" })} aria-label="Open world map" className="grid h-10 w-10 place-items-center rounded-full hover:bg-card">
        <Compass size={21} />
      </button>
      <button onClick={() => open({ type: "notifications" })} aria-label={`Destination news, ${unread} unread`} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-card">
        <Bell size={21} />
        {unread > 0 && <span className="absolute top-2 right-2.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />}
      </button>
      {profile && (
        <button onClick={() => setTab("passport")} aria-label="Your passport" className="ml-1">
          <Avatar name={profile.name} hue={profile.hue} size={36} />
        </button>
      )}
    </header>
  );
}

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "Explore", icon: Compass },
  { id: "groups", label: "Groups", icon: Users },
  { id: "itinerary", label: "Itinerary", icon: ListChecks },
  { id: "passport", label: "Passport", icon: Stamp },
];

export function BottomNav() {
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 px-4 pb-4">
      <div className="flex rounded-[28px] bg-card px-2 py-2 shadow-[0_8px_30px_rgba(20,20,30,0.12)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cx("flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition", tab === id ? "text-accent" : "text-ink/80 hover:text-ink")}
          >
            <Icon size={21} strokeWidth={tab === id ? 2.4 : 1.9} />
            <span className="text-[10.5px] font-bold tracking-wider uppercase">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dismiss(toasts[0].id), toasts[0].levelUp ? 3200 : 2000);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  const t = toasts[0];
  if (!t) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4" aria-live="polite">
      <div key={t.id} className="animate-toast pointer-events-auto flex items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-xl">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-accent">
          <Sparkles size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold">{t.levelUp ? `Level up! You're now Level ${t.levelUp}` : t.text}</div>
          {t.xp ? <div className="text-xs text-[#9EE6BF]">+{t.xp} explorer points</div> : null}
        </div>
      </div>
    </div>
  );
}
