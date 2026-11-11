import { useMemo, useState } from "react";
import { Compass, Plus, Search, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommunities, useDestinations, useMe, useMemberships, usePosts, useSaves } from "../api/hooks";
import { useUi, type CommunityView } from "../store/ui";
import { useRequireAuth } from "../components/auth";
import { Button, Card, Chip, SectionHeader } from "../components/ui";
import { COMMUNITY_CATEGORY_META, CommunityRow, CommunityTile, PostCard } from "../components/CommunityCards";
import { recommendCommunities, searchCommunities, type CommunityReason } from "../lib/communities";
import { prettyCountry } from "../lib/util";
import type { CommunityCategory } from "../types";

/** Community tab: discover the people experiencing the places Explore shows you. */
export function Community() {
  const { t } = useTranslation();
  const view = useUi((s) => s.communityView);
  const setView = useUi((s) => s.setCommunityView);
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const [q, setQ] = useState("");
  const { data: communities = [], isLoading } = useCommunities();

  const views: CommunityView[] = ["forYou", "mine", "discover"];
  const results = q.trim() ? searchCommunities(communities, q) : null;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight font-semibold">{t("community.title")}</h1>
          <p className="text-[14px] text-muted">{t("community.subtitle")}</p>
        </div>
        <button
          onClick={() => requireAuth(t("community.signInToCreate"), () => open({ type: "communityForm" }))}
          aria-label={t("community.create")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm"
        >
          <Plus size={20} />
        </button>
      </div>

      <label className="relative block">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("community.search")}
          aria-label={t("community.search")}
          className="w-full rounded-full border border-line bg-card py-3 pr-11 pl-11 text-[15px] outline-none placeholder:text-faint focus:border-accent"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label={t("explore.clearSearch")} className="absolute top-1/2 right-3 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-chip">
            <X size={14} />
          </button>
        )}
      </label>

      {results ? (
        <section className="space-y-2.5">
          <SectionHeader title={t("community.resultsN", { count: results.length })} />
          {results.map((c, i) => <CommunityRow key={c.id} c={c} seed={i} />)}
          {results.length === 0 && <p className="rounded-2xl bg-card p-4 text-[14px] text-muted">{t("community.noResults")}</p>}
        </section>
      ) : (
        <>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="tablist" aria-label={t("community.title")}>
            {views.map((v) => (
              <Chip key={v} active={view === v} onClick={() => setView(v)}>{t(`community.views.${v}`)}</Chip>
            ))}
          </div>
          {isLoading && <div className="h-40 animate-pulse rounded-3xl bg-card" />}
          {!isLoading && view === "forYou" && <ForYou />}
          {!isLoading && view === "mine" && <MyGroups />}
          {!isLoading && view === "discover" && <Discover />}
        </>
      )}
    </div>
  );
}

function useReasonText() {
  const { t } = useTranslation();
  return (r: CommunityReason) => {
    switch (r.kind) {
      case "place": return r.place ? t("community.reasons.place", { place: r.place }) : t("community.reasons.yourPlaces");
      case "country": return t("community.reasons.country", { country: prettyCountry(r.country) });
      case "styles": return t("community.reasons.styles", { styles: r.styles.map((s) => t(`styles.${s}`)).join(t("reasons.and")) });
      default: return t("community.reasons.popular");
    }
  };
}

function ForYou() {
  const { t } = useTranslation();
  const user = useUi((s) => s.user);
  const setView = useUi((s) => s.setCommunityView);
  const { data: communities = [] } = useCommunities();
  const { data: memberships = [] } = useMemberships();
  const { data: me } = useMe();
  const { data: saves = [] } = useSaves();
  const { data: destinations = [] } = useDestinations();
  const joinedIds = memberships.map((m) => m.communityId);
  const recs = useMemo(
    () => recommendCommunities(communities, {
      me, joined: joinedIds, destinations,
      savedDestinationIds: saves.filter((s) => s.itemType === "destination").map((s) => s.itemId),
    }),
    [communities, me, joinedIds.join(), destinations, saves], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const reasonText = useReasonText();
  const mine = usePosts({ communityIds: joinedIds, limit: 30 }, joinedIds.length > 0);
  const latest = usePosts({ limit: 20 }, joinedIds.length === 0);
  const feed = (joinedIds.length ? mine.data : latest.data)?.filter((p) => p.status === "published") ?? [];
  const loading = joinedIds.length ? mine.isLoading : latest.isLoading;

  return (
    <div className="space-y-6">
      {!user && (
        <Card className="bg-accent-soft p-5">
          <h2 className="font-display text-[22px] font-semibold">{t("community.heroTitle")}</h2>
          <p className="mt-1 text-[14px] text-ink/75">{t("community.heroBody")}</p>
        </Card>
      )}
      {recs.length > 0 && (
        <section>
          <SectionHeader eyebrow={t("community.recommendedEyebrow")} title={t("community.recommended")} action={t("community.seeAll")} onAction={() => setView("discover")} />
          <div className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
            {recs.map((r, i) => <CommunityTile key={r.community.id} c={r.community} seed={i} reason={reasonText(r.reason)} />)}
          </div>
        </section>
      )}
      <section className="space-y-3">
        <SectionHeader title={joinedIds.length ? t("community.fromYourGroups") : t("community.latest")} />
        {loading && <div className="h-40 animate-pulse rounded-3xl bg-card" />}
        {!loading && feed.map((p) => <PostCard key={p.id} post={p} />)}
        {!loading && feed.length === 0 && (
          <Card className="p-5 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent"><Users size={24} /></div>
            <p className="mx-auto mt-3 max-w-[280px] text-[14px] text-muted">{joinedIds.length ? t("community.quietGroups") : t("community.noPostsYet")}</p>
          </Card>
        )}
      </section>
    </div>
  );
}

function MyGroups() {
  const { t } = useTranslation();
  const user = useUi((s) => s.user);
  const open = useUi((s) => s.open);
  const setView = useUi((s) => s.setCommunityView);
  const { data: communities = [] } = useCommunities();
  const { data: memberships = [], isLoading } = useMemberships();
  if (!user) {
    return (
      <Card className="p-5 text-center">
        <p className="text-[14px] text-muted">{t("community.signInForGroups")}</p>
        <Button className="mt-3" onClick={() => open({ type: "auth", reason: t("community.signInToJoin") })}>{t("signInPrompt.cta")}</Button>
      </Card>
    );
  }
  const mine = memberships
    .map((m) => ({ m, c: communities.find((c) => c.id === m.communityId) }))
    .filter((x) => x.c)
    .sort((a, b) => b.m.joinedAt.localeCompare(a.m.joinedAt));
  return (
    <section className="space-y-2.5">
      {isLoading && <div className="h-24 animate-pulse rounded-3xl bg-card" />}
      {mine.map(({ m, c }, i) => (
        <CommunityRow key={c!.id} c={c!} seed={i} note={m.role === "moderator" ? t("community.youModerate") : undefined} />
      ))}
      {!isLoading && mine.length === 0 && (
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent"><Users size={24} /></div>
          <h2 className="font-display mt-3 text-[20px] font-semibold">{t("community.noGroupsTitle")}</h2>
          <p className="mx-auto mt-1 max-w-[280px] text-[14px] text-muted">{t("community.noGroupsBody")}</p>
          <Button className="mt-4" icon={Compass} onClick={() => setView("discover")}>{t("community.views.discover")}</Button>
        </Card>
      )}
      <Button variant="ghost" className="w-full" icon={Plus} onClick={() => open({ type: "communityForm" })}>{t("community.create")}</Button>
    </section>
  );
}

function Discover() {
  const { t } = useTranslation();
  const [cat, setCat] = useState<CommunityCategory | "all">("all");
  const { data: communities = [] } = useCommunities();
  const list = communities.filter((c) => c.status === "published" && (cat === "all" || c.category === cat));
  return (
    <section className="space-y-3">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>{t("explore.all")}</Chip>
        {(Object.keys(COMMUNITY_CATEGORY_META) as CommunityCategory[]).map((k) => (
          <Chip key={k} icon={COMMUNITY_CATEGORY_META[k].icon} active={cat === k} onClick={() => setCat(k)}>{t(`community.categoriesPlural.${k}`)}</Chip>
        ))}
      </div>
      <div className="space-y-2.5">
        {list.map((c, i) => <CommunityRow key={c.id} c={c} seed={i} />)}
        {list.length === 0 && <p className="rounded-2xl bg-card p-4 text-[14px] text-muted">{t("community.noneInCategory")}</p>}
      </div>
    </section>
  );
}
