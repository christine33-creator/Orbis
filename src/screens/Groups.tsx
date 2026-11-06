import { useMemo, useState } from "react";
import { BadgeCheck, Calendar, ChevronRight, CirclePlus, EyeOff, MapPin, MessageCircle, RefreshCw, Route, Sparkles, Star, UserPlus, Check } from "lucide-react";
import { useActiveTrip, useApp } from "../store/useApp";
import { GROUPS, TRAVELERS, travelerById } from "../data/community";
import { destinationById } from "../data/destinations";
import { syncRate } from "../lib/match";
import { tierFor } from "../lib/progress";
import { Avatar, Button, Card, Chip, SectionHeader, STYLE_META, Tag } from "../components/ui";
import { Scene } from "../components/Scene";
import { addDays, cx, fmtRange, fmtShort } from "../lib/util";
import type { GroupExpedition, TravelStyle } from "../types";

const VIS_LABEL = { public: "Visible to All", verified: "Visible to Verified", followers: "Followers Only", private: "Hidden" };

export function Groups() {
  const profile = useApp((s) => s.profile)!;
  const trips = useApp((s) => s.trips);
  const privacy = useApp((s) => s.privacy);
  const myGroups = useApp((s) => s.groups);
  const open = useApp((s) => s.open);
  const setTab = useApp((s) => s.setTab);
  const trip = useActiveTrip();
  const dest = trip ? destinationById(trip.destinationId) : undefined;

  const [destFilter, setDestFilter] = useState<string | "all">(dest?.id ?? "all");
  const [styleFilter, setStyleFilter] = useState<TravelStyle | null>(null);
  const [shuffle, setShuffle] = useState(0);

  const matches = useMemo(() => {
    return TRAVELERS.filter((t) => t.plannedTrip)
      .filter((t) => destFilter === "all" || t.plannedTrip!.destinationId === destFilter)
      .filter((t) => !styleFilter || t.styles.includes(styleFilter))
      .map((t) => ({ t, rate: syncRate(profile, trips, t) }))
      .sort((a, b) => b.rate - a.rate || ((a.t.id.length * 7 + shuffle) % 5) - ((b.t.id.length * 7 + shuffle) % 5));
  }, [profile, trips, destFilter, styleFilter, shuffle]);

  const destOptions = Array.from(new Set([...(trip ? [trip.destinationId] : []), ...profile.watching]));
  const aligned = trip ? TRAVELERS.filter((t) => t.plannedTrip?.destinationId === trip.destinationId).length : 0;
  const allGroups = [...myGroups, ...GROUPS];

  return (
    <div className="space-y-8 pb-4">
      {/* Buddy beacon */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow flex items-center gap-1.5 text-ink/80">
            <span className={cx("h-2 w-2 rounded-full", privacy.beacon ? "bg-green" : "bg-faint")} /> Buddy match beacon
          </span>
          <button onClick={() => setTab("passport")} className="flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-[11.5px] font-bold">
            {privacy.companionMatching ? <span className="h-1.5 w-1.5 rounded-full bg-green" /> : <EyeOff size={12} />}
            {privacy.companionMatching ? VIS_LABEL[privacy.visibility] : "Matching off"}
          </button>
        </div>
        {trip && dest ? (
          <>
            <h2 className="font-display mt-2 text-[26px] leading-tight font-semibold">{dest.name}</h2>
            <p className="mt-1 text-[14px] text-muted">
              {fmtRange(trip.startDate, addDays(trip.startDate, trip.days.length - 1))} · {trip.days.length} days · Seeking 1–3 {profile.styles[0] ? STYLE_META[profile.styles[0]].label.toLowerCase() : ""} explorers
            </p>
            <button onClick={() => document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" })} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-chip p-3 text-left">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent"><Sparkles size={17} /></span>
              <span className="flex-1 truncate text-[14px] font-semibold"><span className="font-bold text-accent">{aligned} traveller{aligned === 1 ? "" : "s"}</span> align with your dates</span>
              <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display mt-2 text-[24px] font-semibold">Light your beacon</h2>
            <p className="mt-1 text-[14px] text-muted">Plan a trip and we'll match you with travellers heading the same way, on the same dates.</p>
            <Button className="mt-4" icon={CirclePlus} onClick={() => open({ type: "newTrip" })}>Plan a trip</Button>
          </>
        )}
      </Card>

      {/* Filters */}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <Chip active={destFilter === "all"} onClick={() => setDestFilter("all")} icon={MapPin}>Anywhere</Chip>
        {destOptions.map((id) => (
          <Chip key={id} active={destFilter === id} onClick={() => setDestFilter(id)}>{destinationById(id)?.name}</Chip>
        ))}
        {profile.styles.map((s) => (
          <Chip key={s} active={styleFilter === s} onClick={() => setStyleFilter(styleFilter === s ? null : s)} icon={STYLE_META[s].icon}>{STYLE_META[s].label}</Chip>
        ))}
      </div>

      {/* Matches */}
      <section id="matches" className="scroll-mt-20">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-[26px] leading-tight font-semibold">Top Companion<br />Matches</h2>
          <button onClick={() => setShuffle((x) => x + 1)} className="flex items-center gap-1 pb-1 text-[13px] font-bold text-accent">
            Refresh <RefreshCw size={13} />
          </button>
        </div>
        {!privacy.companionMatching && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent">
            <EyeOff size={16} /> You're hidden from matches. Others can't find you until you turn matching back on in Passport.
          </div>
        )}
        <div className="mt-4 space-y-4">
          {matches.map(({ t, rate }) => <MatchCard key={t.id} id={t.id} rate={rate} />)}
          {matches.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">
              No one is heading there yet. Start a group and be the first!
            </div>
          )}
        </div>
      </section>

      {/* Group expeditions */}
      <section>
        <SectionHeader title="Active Group Expeditions" />
        <p className="text-[13px] text-muted">Curated small collectives heading out soon</p>
        <div className="mt-4 space-y-4">
          {allGroups.map((g) => <GroupCard key={g.id} g={g} />)}
        </div>
      </section>

      <Button variant="coral" className="w-full py-3.5" icon={CirclePlus} onClick={() => open({ type: "newGroup", destinationId: dest?.id })}>
        Create Trip Group / Find Buddies
      </Button>
    </div>
  );
}

function MatchCard({ id, rate }: { id: string; rate: number }) {
  const t = travelerById(id)!;
  const pt = t.plannedTrip!;
  const d = destinationById(pt.destinationId);
  const connected = useApp((s) => s.connections.includes(id));
  const connect = useApp((s) => s.connect);
  const open = useApp((s) => s.open);
  const isGroup = (t.partySize ?? 1) > 1;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <button onClick={() => open({ type: "traveler", id })} className="relative">
          <Avatar name={t.name} hue={t.hue} size={56} />
          {t.verified && <BadgeCheck size={20} className="absolute -right-1 -bottom-1 rounded-full bg-white fill-green text-white" />}
        </button>
        <button onClick={() => open({ type: "traveler", id })} className="min-w-0 flex-1 text-left">
          <div className="truncate text-[18px] font-bold">{t.name}</div>
          <Tag tone="accent">Lvl {t.level} {tierFor(t.level)}</Tag>
          <div className="mt-1 truncate text-[12.5px] text-muted">@{t.handle} · {t.home}</div>
        </button>
        <div className="text-center">
          <div className={cx("rounded-xl px-2.5 py-1 text-[18px] font-extrabold", rate >= 85 ? "bg-mint text-green" : "bg-chip text-ink")}>{rate}%</div>
          <div className="eyebrow mt-1 text-[9.5px] text-muted">Sync rate</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Tag icon={Calendar}>{d?.name} · {fmtShort(pt.from)}–{fmtShort(pt.to)}</Tag>
        <Tag icon={Star}>{t.journeys} journeys</Tag>
        {t.verified && <Tag tone="green" icon={BadgeCheck}>ID verified</Tag>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.interests.map((i) => (
          <span key={i} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold">{i}</span>
        ))}
      </div>
      <p className="mt-3 rounded-2xl bg-chip p-3 text-[13.5px] text-ink/80 italic">"{pt.note}"</p>
      <div className="mt-4 flex gap-2">
        {isGroup ? (
          <Button variant="dark" className="flex-1" icon={connected ? Check : UserPlus} onClick={() => connect(id)} disabled={connected}>
            {connected ? "Request sent" : "Request to join group"}
          </Button>
        ) : (
          <>
            <Button variant="coral" className="flex-1" icon={connected ? Check : MessageCircle} onClick={() => connect(id)} disabled={connected}>
              {connected ? "Request sent" : "Connect & Chat"}
            </Button>
            <Button variant="soft" className="flex-1" icon={Route} onClick={() => open({ type: "traveler", id })}>Shared Route</Button>
          </>
        )}
      </div>
    </Card>
  );
}

export function GroupCard({ g }: { g: GroupExpedition }) {
  const open = useApp((s) => s.open);
  const joined = useApp((s) => s.joinedGroups.includes(g.id));
  const members = g.memberIds.map((id) => travelerById(id)!).filter(Boolean);
  const count = members.length + (joined && !g.createdByMe ? 1 : 0) + (g.createdByMe ? 1 : 0);
  const leader = g.createdByMe ? "you" : travelerById(g.leaderId)?.name.split(" ")[0];
  return (
    <Card className="overflow-hidden" onClick={() => open({ type: "group", id: g.id })}>
      <div className="relative h-40">
        <Scene scene={g.scene} seed={g.title.length} />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
          {fmtRange(g.from, g.to)} · {g.kind}
        </span>
        {joined && <span className="absolute top-3 right-3 rounded-full bg-green px-3 py-1 text-[11px] font-bold text-white">JOINED</span>}
        <h3 className="font-display absolute right-4 bottom-3 left-4 text-[22px] leading-tight font-semibold text-white">{g.title}</h3>
      </div>
      <div className="flex items-center gap-3 p-4">
        <div className="flex -space-x-2">
          {members.slice(0, 3).map((m) => <Avatar key={m.id} name={m.name} hue={m.hue} size={30} className="ring-2 ring-white" />)}
          {members.length > 3 && <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-chip text-[11px] font-bold ring-2 ring-white">+{members.length - 3}</div>}
        </div>
        <div className="min-w-0 flex-1 text-[12.5px]">
          <div className="font-bold">{count}/{g.capacity} members</div>
          <div className="truncate text-muted">Led by {leader}</div>
        </div>
        <span className="rounded-full bg-chip px-4 py-2 text-[12px] font-bold">DETAILS</span>
      </div>
    </Card>
  );
}
