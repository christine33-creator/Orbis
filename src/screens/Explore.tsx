import { useMemo, useState } from "react";
import { Gem as GemIcon, MapPinPlus, Radio, Search, Sparkles, X } from "lucide-react";
import { useDestinations, useEvents, useGems, useMe, useSaves } from "../api/hooks";
import { useUi } from "../store/ui";
import { suggest } from "../lib/suggest";
import { DestinationCard, EventRow, GemCard } from "../components/Cards";
import { Chip, PULSE_META, SectionHeader } from "../components/ui";
import { useRequireAuth } from "../components/auth";
import type { PulseCategory } from "../types";

type Filter = "all" | "gems" | "places" | PulseCategory;
const PULSE_FILTERS: PulseCategory[] = ["sports", "tech", "fashion", "art", "music", "food", "festival"];

export function Explore() {
  const { data: me } = useMe();
  const { data: destinations = [] } = useDestinations();
  const { data: gems = [], isLoading: gemsLoading } = useGems();
  const { data: events = [] } = useEvents();
  const { data: saves = [] } = useSaves();
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const has = (...f: (string | null | undefined)[]) => !query || f.some((x) => x?.toLowerCase().includes(query));
  const destName = (id: string | null) => destinations.find((d) => d.id === id)?.name;

  const published = gems.filter((g) => g.status === "published");
  const shownGems = published.filter((g) => has(g.name, g.description, g.country, destName(g.destinationId)));
  const shownEvents = events.filter((e) => (filter === "all" || filter === e.category) && has(e.title, e.city, e.summary));
  const shownPlaces = destinations.filter((d) => has(d.name, d.country, d.region, d.tagline));

  const forYou = useMemo(
    () => suggest({ profile: me ?? null, saves, destinations, gems, events }, 10),
    [me, saves, destinations, gems, events],
  );
  const reasonsFor = (type: string, id: string) => forYou.find((s) => s.itemType === type && s.id === id)?.reasons;

  const showGems = filter === "all" || filter === "gems";
  const showPlaces = filter === "all" || filter === "places";
  const showEvents = filter === "all" || PULSE_FILTERS.includes(filter as PulseCategory);
  const topGems = [...shownGems].sort((a, b) => b.upvotes - a.upvotes || b.createdAt.localeCompare(a.createdAt));
  const newGems = [...shownGems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="space-y-8 pb-4">
      <div className="space-y-3">
        <label className="flex items-center gap-3 rounded-full bg-card px-4 py-3 shadow-sm">
          <Search size={19} className="text-accent" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places, gems and happenings" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" aria-label="Search" />
          {q && <button aria-label="Clear search" onClick={() => setQ("")}><X size={18} className="text-muted" /></button>}
        </label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          <Chip active={filter === "gems"} onClick={() => setFilter("gems")} icon={GemIcon}>Hidden Gems</Chip>
          <Chip active={filter === "places"} onClick={() => setFilter("places")}>Destinations</Chip>
          {PULSE_FILTERS.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)} icon={PULSE_META[c].icon}>{PULSE_META[c].label}</Chip>
          ))}
        </div>
      </div>

      {filter === "all" && !query && forYou.length > 0 && (
        <section>
          <SectionHeader eyebrow={me ? "Picked for you" : "Popular right now"} title={<span className="flex items-center gap-2"><Sparkles size={22} className="text-accent" /> For You</span>} />
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x items-start gap-3 overflow-x-auto px-5 pb-2">
            {forYou.slice(0, 8).map((s, i) => {
              if (s.itemType === "gem") {
                const g = gems.find((x) => x.id === s.id);
                return g ? <GemCard key={s.id} gem={g} seed={i} reasons={s.reasons} /> : null;
              }
              if (s.itemType === "destination") {
                const d = destinations.find((x) => x.id === s.id);
                return d ? <DestinationCard key={s.id} d={d} reasons={s.reasons} seed={i} /> : null;
              }
              return null;
            })}
          </div>
        </section>
      )}

      {showGems && (
        <section>
          <SectionHeader eyebrow="From the community" title="Hidden Gems" action={`${shownGems.length} spots`} />
          {gemsLoading ? (
            <div className="mt-4 h-60 animate-pulse rounded-3xl bg-card" />
          ) : topGems.length ? (
            <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-4 overflow-x-auto px-5 pb-2">
              {topGems.slice(0, 12).map((g, i) => <GemCard key={g.id} gem={g} seed={i} />)}
            </div>
          ) : (
            <Empty text={query ? "No gems match that search." : "No hidden gems yet. Be the first to share one."} />
          )}
        </section>
      )}

      {showEvents && (
        <section>
          <div className="flex items-end justify-between">
            <h2 className="flex items-center gap-2 font-display text-[26px] font-semibold"><Radio size={22} className="text-accent" /> Global Pulse</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Reasons to go: what's happening around the world.</p>
          <div className="mt-4 space-y-3">
            {shownEvents.slice(0, 12).map((e) => <EventRow key={e.id} ev={e} reason={reasonsFor("event", e.id)?.[0]} />)}
            {shownEvents.length === 0 && <Empty text="Nothing on in this category yet." />}
          </div>
        </section>
      )}

      {showPlaces && (
        <section>
          <SectionHeader title="Destinations" action={`${shownPlaces.length}`} />
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
            {shownPlaces.map((d, i) => <DestinationCard key={d.id} d={d} seed={i} reasons={reasonsFor("destination", d.id)} />)}
          </div>
          {shownPlaces.length === 0 && <Empty text="No destinations match that search." />}
        </section>
      )}

      {filter === "all" && !query && newGems.length > 0 && (
        <section>
          <SectionHeader title="Newly Shared" />
          <div className="mt-4 space-y-3">
            {newGems.slice(0, 4).map((g, i) => <GemCard key={g.id} gem={g} seed={i + 3} wide />)}
          </div>
        </section>
      )}

      <button
        onClick={() => requireAuth("Sign in to share a hidden gem.", () => open({ type: "shareGem" }))}
        className="flex w-full items-center gap-3 rounded-[24px] bg-navy p-3 text-left text-white shadow-lg"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent"><MapPinPlus size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">Found somewhere special?</div>
          <div className="text-xs text-white/70">Share it and earn +50 explorer points</div>
        </div>
        <span className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold">Share Gem</span>
      </button>
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">
      {text}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
