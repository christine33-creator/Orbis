import { lazy, Suspense, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, useAuthUser, useMe } from "./api/hooks";
import { api, backendStatus } from "./api";
import { useUi } from "./store/ui";
import { BottomNav, Toasts, TopBar } from "./components/Chrome";
import { Onboarding } from "./screens/Onboarding";
import { Explore } from "./screens/Explore";
import { Saved } from "./screens/Saved";
import { Trips } from "./screens/Trips";
import { Passport } from "./screens/Passport";
import { Overlays } from "./screens/Overlays";
import { useTranslation } from "react-i18next";
import i18n, { LANGUAGES, setLanguage, type LanguageCode } from "./i18n";
import { en } from "./i18n/locales/en";
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
  if (backendStatus === "missing") return <NotConfigured />;
  return <ConfiguredShell />;
}

/** Shown when a production build has no Supabase settings, instead of silently using browser storage. */
function NotConfigured() {
  const { t } = useTranslation();
  return (
    <Frame>
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <div className="mx-auto w-fit"><Logo size={44} /></div>
          <h1 className="font-display mt-4 text-[24px] font-semibold">{t("config.title")}</h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[14px] text-muted">{t("config.body")}</p>
        </div>
      </div>
    </Frame>
  );
}

function ConfiguredShell() {
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
  // Follow the language saved on the profile when this device hasn't chosen one yet.
  useEffect(() => {
    const lang = me?.preferences.language;
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem("orbis-lang");
    } catch {
      /* storage unavailable */
    }
    if (lang && !chosen && LANGUAGES.some((l) => l.code === lang)) setLanguage(lang as LanguageCode);
  }, [me?.preferences.language]);

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
        {backendStatus === "demo" && <DemoBanner />}
        {children}
      </div>
    </div>
  );
}

function DemoBanner() {
  const { t } = useTranslation();
  return (
    <div className="bg-navy px-4 py-1.5 text-center text-[11px] font-semibold text-white/80">
      {import.meta.env.VITE_DEMO_PERSONA ? t("demo.personaBanner") : t("demo.banner")}
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
      // Name the biggest award among the newest events that make up this gain.
      const batch: typeof h = [];
      let sum = 0;
      for (const e of h) {
        if (sum >= gained) break;
        batch.push(e);
        sum += e.amount;
      }
      const top = [...batch].sort((a, b) => b.amount - a.amount)[0];
      const reason = top?.reason as keyof typeof en.xp | undefined;
      toast({ text: i18n.t(reason && reason in en.xp ? `xp.${reason}` : "xp.earned"), sub: i18n.t("xp.plusPoints", { n: gained }), tone: "xp" });
    }).catch(() => undefined);
  }, [xp, toast]);
}
