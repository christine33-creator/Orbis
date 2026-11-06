import { useMemo, useState } from "react";
import { ArrowRight, BookmarkCheck, BookmarkPlus, ChevronRight, Gem, Heart, Layers, Lightbulb, MapPin, MapPinPlus, Radio, Search, SlidersHorizontal, Star, ThumbsUp, X } from "lucide-react";
import { useApp } from "../store/useApp";
import { DESTINATIONS } from "../data/destinations";
import { PULSE, TRAVELERS } from "../data/community";
import { recommend } from "../lib/persona";
import { Scene } from "../components/Scene";
import { Avatar, Card, Chip, PULSE_META, SectionHeader, Tag } from "../components/ui";
import { WorldMap } from "../components/WorldMap";
import { ago, compact, cx, prettyCountry } from "../lib/util";
import type { Destination, PulseCategory } from "../types";

type Filter = "all" | "gems" | PulseCategory;

export function Explore() {
  const profile = useApp((s) => s.profile)!;
  const sharedGems = useApp((s) => s.sharedGems);
  const open = useApp((s) => s.open);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const matches = (...fields: string[]) => !query || fields.some((f) => f.toLowerCase().includes(query));

  const ranked = useMemo(() => recommend(profile, { gemsOnly: true }), [profile]);
  const top = ranked[0];
  const gems = [...sharedGems.map((g) => ({ ...g, fit: 0 })), ...ranked].filter((d) => matches(d.name, d.country, d.tagline, d.region));
  const pulse = PULSE.filter((p) => (filter === "all" || filter === "gems" || p.category === filter) && matches(p.title, p.city, p.summary, p.category));
  const showGems = filter === "all" || filter === "gems";
  const showPulse = filter !== "gems";
  const toFollow = TRAVELERS.filter((t) => t.styles.some((s) => profile.styles.includes(s))).slice(0, 6);

  return (
    <div className="space-y-8 pb-4">
      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-full bg-card px-4 py-3 shadow-sm">
          <Search size={19} className="text-accent" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search unmapped gems, culture peaks" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" aria-label="Search" />
          {q ? (
            <button aria-label="Clear search" onClick={() => setQ("")}><X size={18} className="text-muted" /></button>
          ) : (
            <SlidersHorizontal size={18} className="text-muted" />
          )}
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          <Chip active={filter === "gems"} onClick={() => setFilter("gems")} icon={Gem}>Hidden Gems</Chip>
          {(Object.keys(PULSE_META) as PulseCategory[]).map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)} icon={PULSE_META[c].icon}>{PULSE_META[c].label}</Chip>
          ))}
        </div>
      </div>

      {/* Gems radar hero */}
      {showGems && !query && top && <GemsRadar top={top} onOpen={() => open({ type: "destination", id: top.id })} onMap={() => open({ type: "map" })} />}

      {/* Curated hidden gems */}
      {showGems && gems.length > 0 && (
        <section>
          <SectionHeader eyebrow="Radar detection" title="Curated Hidden Gems" action={`${gems.length} spots`} />
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2">
            {gems.map((d, i) => <GemCard key={d.id} d={d} seed={i} />)}
          </div>
        </section>
      )}

      {/* World map preview */}
      {!query && filter === "all" && (
        <section>
          <SectionHeader title="Your World" action="Open map" onAction={() => open({ type: "map" })} />
          <Card className="mt-4 overflow-hidden" onClick={() => open({ type: "map" })}>
            <WorldMap
              interactive={false}
              visited={profile.visited}
              pins={DESTINATIONS.map((d) => ({ id: d.id, lat: d.lat, lng: d.lng, label: d.name, tone: profile.watching.includes(d.id) ? "mine" : d.hiddenGem ? "gem" : "popular" }))}
              className="aspect-[1.9]"
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-[12px] font-semibold text-muted">
              <Legend color="#F26B4F" label="Hidden gem" />
              <Legend color="#B8361C" label="Popular" />
              <Legend color="#1E8A5A" label="On your radar" />
              <Legend color="#F4B8A6" label="Visited" square />
            </div>
          </Card>
        </section>
      )}

      {/* Global pulse */}
      {showPulse && (
        <section>
          <div className="flex items-end justify-between">
            <h2 className="flex items-center gap-2 font-display text-[26px] font-semibold">
              <Radio size={22} className="text-accent" /> Global Pulse
            </h2>
            <span className="flex items-center gap-1.5 pb-1 text-[13px] font-bold text-accent">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Live
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">What travellers are gathering for around the world.</p>
          <div className="mt-4 space-y-3">
            {pulse.map((p) => (
              <Card key={p.id} className="flex items-center gap-4 p-3 pr-4" onClick={() => open({ type: "destination", id: p.destinationId })}>
                <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl"><Scene scene={p.scene} seed={p.id.length} /></div>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow text-accent">
                    {p.city} • {PULSE_META[p.category].label} <span className="font-medium text-muted normal-case">· {ago(p.minutesAgo)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[16px] font-bold">{p.title}</div>
                  <div className="truncate text-[13px] text-muted">{p.summary}</div>
                </div>
                <ChevronRight size={18} className="shrink-0" />
              </Card>
            ))}
            {pulse.length === 0 && <Empty text="Nothing matches that search yet." />}
          </div>
        </section>
      )}

      {/* People to follow */}
      {!query && filter === "all" && <FollowRow people={toFollow} />}

      {/* Share CTA */}
      <button onClick={() => open({ type: "shareGem" })} className="flex w-full items-center gap-3 rounded-[24px] bg-navy p-3 pl-3 text-left text-white shadow-lg">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent"><MapPinPlus size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">Discovered somewhere new?</div>
          <div className="text-xs text-white/70">Earn +50 Explorer Points</div>
        </div>
        <span className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold">Share Gem</span>
      </button>
    </div>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx("h-2.5 w-2.5", square ? "rounded-sm" : "rounded-full")} style={{ background: color }} />
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">{text}</div>;
}

function GemsRadar({ top, onOpen, onMap }: { top: Destination & { fit: number }; onOpen: () => void; onMap: () => void }) {
  const saved = useApp((s) => s.savedGems.includes(top.id));
  const toggleSave = useApp((s) => s.toggleSaveGem);
  const unmapped = DESTINATIONS.filter((d) => d.hiddenGem).length * 3;
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-navy p-4 text-white">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
        <path d="M0 80 Q100 40 200 90 T400 70" stroke="#3A4560" strokeDasharray="4 6" fill="none" />
        <path d="M0 170 Q120 120 220 160 T400 140" stroke="#3A4560" strokeDasharray="4 6" fill="none" />
        <g transform="translate(200 120)">
          {[30, 60, 90].map((r) => <circle key={r} r={r} fill="none" stroke="#2F3A52" />)}
          <path d="M0 0 L90 0 A90 90 0 0 0 63 -63 Z" fill="#B8361C" opacity="0.22" className="animate-sweep" style={{ transformBox: "view-box", transformOrigin: "0 0" }} />
        </g>
      </svg>
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wider">
          <span className="h-2 w-2 rounded-full bg-coral" /> {unmapped} UNMAPPED SPOTS
        </span>
        <button onClick={onMap} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-ink">
          <Layers size={14} /> Gems Radar
        </button>
      </div>
      <div className="relative mx-auto my-6 grid h-16 w-16 place-items-center rounded-full bg-accent shadow-[0_0_0_10px_rgba(184,54,28,0.25)]">
        <Gem size={26} />
      </div>
      <div className="relative rounded-3xl bg-card p-4 text-ink">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
            <Tag tone="accent">Top match</Tag>
            <span className="flex items-center gap-1 text-accent"><Star size={13} /> {(4.5 + (top.fit % 5) / 10).toFixed(1)}</span>
            <span className="text-muted">{top.fit}% Fit</span>
          </div>
          <button aria-label={saved ? "Unsave" : "Save gem"} onClick={() => toggleSave(top.id)} className="grid h-10 w-10 place-items-center rounded-full border border-line">
            {saved ? <BookmarkCheck size={18} className="text-accent" /> : <BookmarkPlus size={18} />}
          </button>
        </div>
        <h3 className="font-display mt-1 text-[26px] leading-tight font-semibold">{top.name}</h3>
        <p className="mt-1 truncate text-[14px] text-muted">{top.tagline}</p>
        <div className="mt-3 flex items-center justify-between text-[13px] font-semibold">
          <span className="flex items-center gap-1.5"><MapPin size={14} className="text-accent" /> {top.region}, {prettyCountry(top.country)}</span>
          <button onClick={onOpen} className="flex items-center gap-1 font-bold text-accent">View <ArrowRight size={14} /></button>
        </div>
      </div>
    </section>
  );
}

function GemCard({ d, seed }: { d: Destination; seed: number }) {
  const open = useApp((s) => s.open);
  const saved = useApp((s) => s.savedGems.includes(d.id));
  const voted = useApp((s) => s.upvoted.includes(d.id));
  const toggleSave = useApp((s) => s.toggleSaveGem);
  const toggleUpvote = useApp((s) => s.toggleUpvote);
  return (
    <Card className="relative w-[78%] max-w-[300px] shrink-0 snap-start overflow-hidden">
      <button onClick={() => open({ type: "destination", id: d.id })} className="relative block h-40 w-full">
        <Scene scene={d.scene} seed={seed} />
        <span className="absolute top-3 left-3 rounded-full bg-navy/70 px-3 py-1 text-[10.5px] font-bold tracking-wider text-white uppercase backdrop-blur">
          {d.styles.includes("eco") ? "Nature & Solitude" : d.styles.includes("culture") ? "Heritage" : "Adventure"}
        </span>
      </button>
      <button aria-label={saved ? "Unsave" : "Save"} onClick={() => toggleSave(d.id)} className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90">
        <Heart size={17} className={saved ? "fill-accent text-accent" : ""} />
      </button>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[18px] font-bold">{d.name}</h3>
          <button onClick={() => toggleUpvote(d.id)} aria-pressed={voted} className={cx("flex items-center gap-1 text-[13px] font-bold", voted ? "text-accent" : "")}>
            <ThumbsUp size={15} className={cx("text-accent", voted && "fill-accent")} /> {compact(d.upvotes + (voted ? 1 : 0))}
          </button>
        </div>
        <p className="mt-1 line-clamp-2 text-[13.5px] text-muted">{d.tagline}</p>
        <div className="mt-3 flex gap-2 rounded-2xl bg-chip p-3">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-[12.5px] font-semibold">"{d.tip.text}"</p>
            <p className="mt-1 text-[11.5px] font-bold text-accent">{d.tip.author}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FollowRow({ people }: { people: typeof TRAVELERS }) {
  const following = useApp((s) => s.following);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const open = useApp((s) => s.open);
  if (!people.length) return null;
  return (
    <section>
      <SectionHeader title="Explorers Like You" />
      <div className="no-scrollbar -mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-1">
        {people.map((t) => {
          const f = following.includes(t.id);
          return (
            <Card key={t.id} className="w-[148px] shrink-0 p-4 text-center">
              <button onClick={() => open({ type: "traveler", id: t.id })} className="w-full">
                <Avatar name={t.name} hue={t.hue} size={56} className="mx-auto" />
                <div className="mt-2 truncate text-[14px] font-bold">{t.name}</div>
                <div className="truncate text-[12px] text-muted">@{t.handle}</div>
              </button>
              <button onClick={() => toggleFollow(t.id)} className={cx("mt-3 w-full rounded-full py-2 text-[12.5px] font-bold", f ? "bg-chip text-ink" : "bg-accent text-white")}>
                {f ? "Following" : "Follow"}
              </button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
