import { useMemo, useState } from "react";
import {
  ArrowUpRight, AtSign, BadgeCheck, BookmarkCheck, BookmarkPlus, Calendar, Check, CirclePlus, Gem, Lightbulb, LogOut, MapPin, PartyPopper,
  Radar, Search, ShieldCheck, Siren, Sparkles, Ticket, UserPlus, Users,
} from "lucide-react";
import { useApp, type Overlay } from "../store/useApp";
import { DESTINATIONS, destinationById } from "../data/destinations";
import { GROUPS, NEWS, PULSE, TRAVELERS, travelerById } from "../data/community";
import { Avatar, Button, Card, Chip, Field, inputCls, PULSE_META, Sheet, STYLE_META, Tag, TRIP_STYLE_META } from "../components/ui";
import { Scene } from "../components/Scene";
import { COUNTRY_NAMES, WorldMap, type MapPin as Pin } from "../components/WorldMap";
import { FieldNotes } from "./Itinerary";
import { syncRate } from "../lib/match";
import { XP, tierFor } from "../lib/progress";
import { addDays, compact, cx, fmtRange, prettyCountry, todayIso, uid } from "../lib/util";
import type { Destination, Profile, SceneKind, SocialLinks, TravelStyle, TripStyle } from "../types";

export function Overlays() {
  const overlays = useApp((s) => s.overlays);
  const close = useApp((s) => s.close);
  return (
    <>
      {overlays.map((o, i) => (
        <OverlayView key={i} o={o} onClose={close} />
      ))}
    </>
  );
}

function OverlayView({ o, onClose }: { o: Overlay; onClose: () => void }) {
  switch (o.type) {
    case "map": return <MapSheet onClose={onClose} focus={o.focus} />;
    case "destination": return <DestinationSheet id={o.id} onClose={onClose} />;
    case "traveler": return <TravelerSheet id={o.id} onClose={onClose} />;
    case "group": return <GroupSheet id={o.id} onClose={onClose} />;
    case "notifications": return <NewsSheet onClose={onClose} />;
    case "newTrip": return <NewTripSheet onClose={onClose} destinationId={o.destinationId} />;
    case "newGroup": return <NewGroupSheet onClose={onClose} destinationId={o.destinationId} />;
    case "shareGem": return <ShareGemSheet onClose={onClose} />;
    case "addTip": return <AddTipSheet onClose={onClose} destinationId={o.destinationId} />;
    case "addStop": return <AddStopSheet onClose={onClose} />;
    case "editProfile": return <EditProfileSheet onClose={onClose} />;
    case "xpLog": return <XpLogSheet onClose={onClose} />;
  }
}

/* ---------------- World map ---------------- */

type MapLayer = "all" | "gems" | "events" | "radar";

function MapSheet({ onClose, focus }: { onClose: () => void; focus?: string }) {
  const profile = useApp((s) => s.profile)!;
  const sharedGems = useApp((s) => s.sharedGems);
  const open = useApp((s) => s.open);
  const [layer, setLayer] = useState<MapLayer>("all");
  const [sel, setSel] = useState<string | null>(focus ?? null);
  const [q, setQ] = useState("");

  const all = [...sharedGems, ...DESTINATIONS];
  const eventIds = new Set(PULSE.map((p) => p.destinationId));
  const shown = all.filter((d) =>
    layer === "all" ? true : layer === "gems" ? d.hiddenGem : layer === "events" ? eventIds.has(d.id) : profile.watching.includes(d.id),
  );
  const pins: Pin[] = shown.map((d) => ({
    id: d.id, lat: d.lat, lng: d.lng, label: d.name,
    tone: profile.watching.includes(d.id) ? "mine" : layer === "events" ? "event" : d.hiddenGem ? "gem" : "popular",
  }));
  const selected = all.find((d) => d.id === sel);
  const results = q ? all.filter((d) => `${d.name} ${d.country}`.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];

  return (
    <Sheet full title="World Map" onClose={onClose}>
      <div className="relative -mx-5">
        <div className="absolute inset-x-5 top-0 z-10">
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 shadow-md">
            <Search size={17} className="text-accent" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a destination" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
          </div>
          {results.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-2xl bg-card shadow-lg">
              {results.map((d) => (
                <button key={d.id} onClick={() => { setSel(d.id); setQ(""); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] hover:bg-chip">
                  <MapPin size={14} className="text-accent" /> <b>{d.name}</b> <span className="text-muted">{prettyCountry(d.country)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <WorldMap pins={pins} visited={profile.visited} selected={sel} onSelect={setSel} showLabels cover initialZoom={1.6} className="h-[58vh] bg-[#EAF0F4]" />
      </div>
      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        <Chip active={layer === "all"} onClick={() => setLayer("all")}>All {all.length}</Chip>
        <Chip active={layer === "gems"} onClick={() => setLayer("gems")} icon={Gem}>Hidden gems</Chip>
        <Chip active={layer === "events"} onClick={() => setLayer("events")} icon={Ticket}>Live events</Chip>
        <Chip active={layer === "radar"} onClick={() => setLayer("radar")} icon={Radar}>My radar</Chip>
      </div>
      {selected ? (
        <Card className="mt-4 flex gap-3 p-3" onClick={() => open({ type: "destination", id: selected.id })}>
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl"><Scene scene={selected.scene} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {selected.hiddenGem && <Tag tone="accent">Gem</Tag>}
              <span className="truncate text-[12px] text-muted">{selected.region}, {prettyCountry(selected.country)}</span>
            </div>
            <div className="mt-1 truncate text-[17px] font-bold">{selected.name}</div>
            <div className="line-clamp-2 text-[12.5px] text-muted">{selected.tagline}</div>
          </div>
        </Card>
      ) : (
        <p className="mt-4 text-center text-[13px] text-muted">Tap a pin to preview. Shaded countries are ones you've visited.</p>
      )}
    </Sheet>
  );
}

/* ---------------- Destination ---------------- */

function DestinationSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const shared = useApp((s) => s.sharedGems);
  const d = destinationById(id) ?? shared.find((g) => g.id === id);
  const s = useApp();
  if (!d) return null;
  const saved = s.savedGems.includes(d.id);
  const watching = s.profile!.watching.includes(d.id);
  const news = NEWS.filter((n) => n.destinationId === d.id);
  const events = PULSE.filter((p) => p.destinationId === d.id);
  const travelers = TRAVELERS.filter((t) => t.plannedTrip?.destinationId === d.id);
  const groups = GROUPS.filter((g) => g.destinationId === d.id);

  return (
    <Sheet full title={d.name} onClose={onClose}>
      <div className="relative -mx-5 h-56">
        <Scene scene={d.scene} seed={d.name.length} />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
        <div className="absolute right-5 bottom-4 left-5 text-white">
          <div className="flex gap-2">{d.hiddenGem && <Tag tone="accent">Hidden gem</Tag>}<Tag>{d.popularity < 40 ? "Low crowds" : d.popularity < 75 ? "Moderate crowds" : "Busy"}</Tag></div>
          <h1 className="font-display mt-2 text-[32px] leading-tight font-semibold">{d.name}</h1>
          <div className="flex items-center gap-1 text-[13px]"><MapPin size={13} /> {d.region}, {prettyCountry(d.country)}</div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1 px-3" icon={CirclePlus} onClick={() => s.open({ type: "newTrip", destinationId: d.id })}>Plan trip</Button>
        <Button variant={watching ? "soft" : "ghost"} className="flex-1 px-3" icon={watching ? Check : Radar} onClick={() => s.toggleWatch(d.id)}>{watching ? "On radar" : "Get news"}</Button>
        <button aria-label={saved ? "Unsave" : "Save"} onClick={() => s.toggleSaveGem(d.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card">
          {saved ? <BookmarkCheck size={18} className="text-accent" /> : <BookmarkPlus size={18} />}
        </button>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed">{d.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="p-3"><div className="eyebrow text-muted">Best time</div><div className="mt-1 text-[14px] font-bold">{d.bestTime}</div></Card>
        <Card className="p-3"><div className="eyebrow text-muted">Community</div><div className="mt-1 text-[14px] font-bold">{compact(d.upvotes)} upvotes</div></Card>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {d.styles.map((st) => <Tag key={st} icon={STYLE_META[st].icon}>{STYLE_META[st].label}</Tag>)}
      </div>
      <div className="mt-4 flex gap-2 rounded-2xl bg-accent-soft p-4">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent" />
        <div><p className="text-[14px] font-semibold">"{d.tip.text}"</p><p className="mt-1 text-[12px] font-bold text-accent">{d.tip.author}</p></div>
      </div>

      {(news.length > 0 || events.length > 0) && (
        <section className="mt-7">
          <h2 className="text-[19px] font-bold">News & happenings</h2>
          <div className="mt-3 space-y-2">
            {events.map((e) => (
              <Card key={e.id} className="p-3"><div className="eyebrow text-accent">{PULSE_META[e.category].label} · live</div><div className="mt-1 font-bold">{e.title}</div><div className="text-[12.5px] text-muted">{e.summary}</div></Card>
            ))}
            {news.map((n) => (
              <Card key={n.id} className="p-3"><div className="eyebrow text-muted">{n.kind} · {n.hoursAgo}h ago</div><div className="mt-1 font-bold">{n.title}</div><div className="text-[12.5px] text-muted">{n.body}</div></Card>
            ))}
          </div>
        </section>
      )}

      {travelers.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[19px] font-bold">Travellers heading here</h2>
          <div className="mt-3 space-y-2">
            {travelers.map((t) => (
              <Card key={t.id} className="flex items-center gap-3 p-3" onClick={() => s.open({ type: "traveler", id: t.id })}>
                <Avatar name={t.name} hue={t.hue} size={42} />
                <div className="min-w-0 flex-1"><div className="font-bold">{t.name}</div><div className="text-[12px] text-muted">{fmtRange(t.plannedTrip!.from, t.plannedTrip!.to)}</div></div>
                <span className="rounded-lg bg-mint px-2 py-1 text-[12px] font-bold text-green">{syncRate(s.profile!, s.trips, t)}%</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[19px] font-bold">Group expeditions</h2>
          <div className="mt-3 space-y-2">
            {groups.map((g) => (
              <Card key={g.id} className="flex items-center gap-3 p-3" onClick={() => s.open({ type: "group", id: g.id })}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><Users size={18} /></span>
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{g.title}</div><div className="text-[12px] text-muted">{fmtRange(g.from, g.to)} · {g.memberIds.length}/{g.capacity}</div></div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="mt-7"><FieldNotes destinationId={d.id} /></div>
    </Sheet>
  );
}

/* ---------------- Traveller profile ---------------- */

const SOCIAL_URL: Record<keyof SocialLinks, (h: string) => string> = {
  instagram: (h) => `https://instagram.com/${h}`,
  x: (h) => `https://x.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  strava: (h) => `https://www.strava.com/athletes/${h}`,
};

function TravelerSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = travelerById(id);
  const s = useApp();
  if (!t) return null;
  const following = s.following.includes(id);
  const connected = s.connections.includes(id);
  const d = t.plannedTrip && destinationById(t.plannedTrip.destinationId);
  return (
    <Sheet title="Traveller" onClose={onClose}>
      <div className="text-center">
        <div className="relative mx-auto w-fit">
          <Avatar name={t.name} hue={t.hue} size={84} ring />
          {t.verified && <BadgeCheck size={24} className="absolute right-0 bottom-0 rounded-full bg-white fill-green text-white" />}
        </div>
        <h2 className="font-display mt-3 text-[26px] font-semibold">{t.name}</h2>
        <div className="text-[13px] text-muted">@{t.handle} · {t.home}</div>
        <div className="mt-2"><Tag tone="accent">Lvl {t.level} {tierFor(t.level)}</Tag></div>
        <p className="mx-auto mt-3 max-w-[300px] text-[14px]">{t.bio}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[{ n: t.countries, l: "Countries" }, { n: compact(t.followers + (following ? 1 : 0)), l: "Followers" }, { n: t.journeys, l: "Journeys" }].map((x) => (
          <Card key={x.l} className="py-3"><div className="font-display text-[22px] font-semibold">{x.n}</div><div className="eyebrow text-[9.5px] text-muted">{x.l}</div></Card>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant={following ? "soft" : "primary"} className="flex-1" icon={following ? Check : UserPlus} onClick={() => s.toggleFollow(id)}>{following ? "Following" : "Follow"}</Button>
        <Button variant="dark" className="flex-1" icon={connected ? Check : Sparkles} disabled={connected} onClick={() => s.connect(id)}>{connected ? "Requested" : "Travel together"}</Button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {t.styles.map((st) => <Tag key={st} icon={STYLE_META[st].icon}>{STYLE_META[st].label}</Tag>)}
      </div>
      {t.plannedTrip && d && (
        <Card className="mt-5 p-4">
          <div className="eyebrow text-accent">Upcoming trip</div>
          <div className="mt-1 text-[16px] font-bold">{d.name} · {fmtRange(t.plannedTrip.from, t.plannedTrip.to)}</div>
          <p className="mt-1 text-[13px] text-muted italic">"{t.plannedTrip.note}"</p>
          <button onClick={() => s.open({ type: "destination", id: d.id })} className="mt-2 text-[13px] font-bold text-accent">View destination →</button>
        </Card>
      )}
      <div className="mt-5 space-y-2">
        {(Object.keys(t.socials) as (keyof SocialLinks)[]).map((k) => (
          <a key={k} href={SOCIAL_URL[k](t.socials[k]!)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <AtSign size={17} className="text-accent" />
            <span className="flex-1 text-[14px] font-semibold capitalize">{k === "x" ? "X / Twitter" : k} <span className="font-normal text-muted">@{t.socials[k]}</span></span>
            <ArrowUpRight size={17} />
          </a>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- Group ---------------- */

function GroupSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useApp();
  const g = [...s.groups, ...GROUPS].find((x) => x.id === id);
  if (!g) return null;
  const joined = s.joinedGroups.includes(g.id);
  const members = g.memberIds.map(travelerById).filter(Boolean);
  const count = members.length + (joined ? 1 : 0);
  const full = count >= g.capacity && !joined;
  const d = destinationById(g.destinationId);
  return (
    <Sheet title={g.title} onClose={onClose}>
      <div className="-mx-5 h-40 overflow-hidden"><Scene scene={g.scene} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tag icon={Calendar}>{fmtRange(g.from, g.to)}</Tag>
        <Tag icon={MapPin}>{d?.name}</Tag>
        <Tag tone="accent">{g.kind}</Tag>
      </div>
      <p className="mt-3 text-[14.5px]">{g.blurb}</p>
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-[17px] font-bold">Crew</h3>
        <span className="text-[13px] font-bold text-muted">{count}/{g.capacity} spots filled</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip"><div className="h-full bg-accent" style={{ width: `${(count / g.capacity) * 100}%` }} /></div>
      <div className="mt-3 space-y-2">
        {(g.createdByMe || joined) && (
          <Card className="flex items-center gap-3 p-3">
            <Avatar name={s.profile!.name} hue={s.profile!.hue} size={38} />
            <div className="flex-1 font-bold">You {g.createdByMe && <span className="text-[12px] font-semibold text-accent">· Leader</span>}</div>
          </Card>
        )}
        {members.map((m) => (
          <Card key={m!.id} className="flex items-center gap-3 p-3" onClick={() => s.open({ type: "traveler", id: m!.id })}>
            <Avatar name={m!.name} hue={m!.hue} size={38} />
            <div className="min-w-0 flex-1"><div className="font-bold">{m!.name}</div><div className="text-[12px] text-muted">Lvl {m!.level} · {m!.home}</div></div>
            {m!.id === g.leaderId && <Tag tone="accent">Leader</Tag>}
          </Card>
        ))}
      </div>
      <div className="mt-5">
        {joined ? (
          <Button variant="ghost" className="w-full" icon={LogOut} onClick={() => s.leaveGroup(g.id)}>{g.createdByMe ? "Close group" : "Leave group"}</Button>
        ) : (
          <Button className="w-full" icon={UserPlus} disabled={full} onClick={() => s.joinGroup(g.id)}>{full ? "Group full" : `Join expedition · +${XP.joinGroup} XP`}</Button>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- News ---------------- */

function NewsSheet({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const watching = s.profile!.watching;
  const items = NEWS.filter((n) => watching.includes(n.destinationId)).sort((a, b) => a.hoursAgo - b.hoursAgo);
  const unreadIds = items.filter((n) => !s.readNews.includes(n.id)).map((n) => n.id);
  return (
    <Sheet
      title="Destination News"
      onClose={() => { s.markNewsRead(items.map((n) => n.id)); onClose(); }}
    >
      <p className="-mt-1 mb-4 text-[13px] text-muted">Updates for the {watching.length} destinations on your radar.</p>
      <div className="space-y-3">
        {items.map((n) => {
          const d = destinationById(n.destinationId)!;
          const unread = unreadIds.includes(n.id);
          return (
            <Card key={n.id} className="flex gap-3 p-4" onClick={() => s.open({ type: "destination", id: d.id })}>
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", n.kind === "alert" ? "bg-coral text-white" : n.kind === "intel" ? "bg-mint text-green" : "bg-accent-soft text-accent")}>
                {n.kind === "alert" ? <Siren size={18} /> : n.kind === "intel" ? <ShieldCheck size={18} /> : <PartyPopper size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-accent">{d.name}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted">{n.hoursAgo}h ago {unread && <span className="h-2 w-2 rounded-full bg-accent" />}</span>
                </div>
                <div className="mt-1 text-[14.5px] font-bold">{n.title}</div>
                <div className="text-[12.5px] text-muted">{n.body}</div>
              </div>
            </Card>
          );
        })}
        {items.length === 0 && <div className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">Add destinations to your radar to get news here.</div>}
      </div>
    </Sheet>
  );
}

/* ---------------- Forms ---------------- */

function DestinationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const watching = useApp((s) => s.profile!.watching);
  const sorted = [...DESTINATIONS].sort((a, b) => Number(watching.includes(b.id)) - Number(watching.includes(a.id)) || a.name.localeCompare(b.name));
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a destination</option>
      {sorted.map((d) => <option key={d.id} value={d.id}>{d.name}, {prettyCountry(d.country)}</option>)}
    </select>
  );
}

function NewTripSheet({ onClose, destinationId }: { onClose: () => void; destinationId?: string }) {
  const createTrip = useApp((s) => s.createTrip);
  const [dest, setDest] = useState(destinationId ?? "");
  const [style, setStyle] = useState<TripStyle>("culture");
  const [start, setStart] = useState(addDays(todayIso(), 14));
  const [days, setDays] = useState(5);
  const [title, setTitle] = useState("");
  return (
    <Sheet
      title="Plan a trip"
      onClose={onClose}
      footer={<Button className="w-full" icon={Sparkles} disabled={!dest} onClick={() => createTrip(dest, style, start, days, title.trim() || undefined)}>Generate itinerary · +{XP.createTrip} XP</Button>}
    >
      <div className="space-y-5">
        <Field label="Destination"><DestinationSelect value={dest} onChange={setDest} /></Field>
        <Field group label="Trip style">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TRIP_STYLE_META) as TripStyle[]).map((st) => {
              const M = TRIP_STYLE_META[st];
              return (
                <button key={st} onClick={() => setStyle(st)} className={cx("rounded-2xl border p-3 text-left", style === st ? "border-accent bg-accent-soft" : "border-line bg-card")}>
                  <div className="flex items-center gap-2 font-bold"><M.icon size={16} className={style === st ? "text-accent" : ""} /> {M.label}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted">{M.blurb}</div>
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Days"><input type="number" min={1} max={21} className={inputCls} value={days} onChange={(e) => setDays(Math.max(1, Math.min(21, Number(e.target.value) || 1)))} /></Field>
        </div>
        <Field label="Trip name" hint="Optional"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kyoto Autumn Odyssey" /></Field>
      </div>
    </Sheet>
  );
}

function NewGroupSheet({ onClose, destinationId }: { onClose: () => void; destinationId?: string }) {
  const createGroup = useApp((s) => s.createGroup);
  const [dest, setDest] = useState(destinationId ?? "");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("Adventure");
  const [from, setFrom] = useState(addDays(todayIso(), 21));
  const [to, setTo] = useState(addDays(todayIso(), 28));
  const [capacity, setCapacity] = useState(6);
  const [blurb, setBlurb] = useState("");
  const d = destinationById(dest);
  return (
    <Sheet
      title="Create a trip group"
      onClose={onClose}
      footer={
        <Button className="w-full" icon={Users} disabled={!d || !title.trim()} onClick={() => d && createGroup({ title: title.trim(), destinationId: d.id, from, to: to < from ? from : to, kind, capacity, blurb: blurb.trim() || `Join us in ${d.name}!`, scene: d.scene })}>
          Publish group · +{XP.createGroup} XP
        </Button>
      }
    >
      <div className="space-y-5">
        <Field label="Destination"><DestinationSelect value={dest} onChange={setDest} /></Field>
        <Field label="Group name"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Svaneti Summer Trek Crew" /></Field>
        <Field group label="Vibe">
          <div className="flex flex-wrap gap-2">
            {["Adventure", "Trekking", "Foodie", "Coliving", "Festival", "Photography", "Sports"].map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Field label={`Group size: ${capacity}`}><input type="range" min={2} max={12} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-full accent-[#B8361C]" /></Field>
        <Field label="Description"><textarea className={cx(inputCls, "min-h-[80px] resize-none")} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="What's the plan? Who are you looking for?" /></Field>
      </div>
    </Sheet>
  );
}

const SCENE_PALETTES: Record<SceneKind, [string, string, string, string]> = {
  mountain: ["#9FC3E7", "#EAF1F7", "#6F86A3", "#2F3D4F"],
  water: ["#A8D8C8", "#EAF6EF", "#3E8E6D", "#1F4D3B"],
  city: ["#E9B9A0", "#F7E7DC", "#9C6B5A", "#3E2C2A"],
  temple: ["#F7C59F", "#F2E6D8", "#B44A2C", "#3D2B25"],
  forest: ["#F5C38B", "#FBEAD3", "#5E8C5A", "#24402A"],
  desert: ["#F5B998", "#FBE9DC", "#C0705A", "#6B3A2E"],
  coast: ["#F6C28B", "#FCEBD5", "#D9886A", "#5A6B8C"],
};

function ShareGemSheet({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [tagline, setTagline] = useState("");
  const [tip, setTip] = useState("");
  const [kind, setKind] = useState<SceneKind>("mountain");
  const [styles, setStyles] = useState<TravelStyle[]>(["adventure"]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const valid = name.trim() && country && tagline.trim() && tip.trim();

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const submit = () => {
    const anchor = DESTINATIONS.find((d) => d.country === country);
    const gem: Destination = {
      id: `gem-${uid()}`, name: name.trim(), country, region: country, lat: coords?.lat ?? anchor?.lat ?? 0, lng: coords?.lng ?? anchor?.lng ?? 0,
      hiddenGem: true, popularity: 5, styles, tagline: tagline.trim(), description: tagline.trim(), bestTime: "Ask the community",
      upvotes: 0, tip: { text: tip.trim(), author: `@${s.profile!.handle}` }, scene: { kind, palette: SCENE_PALETTES[kind] },
    };
    s.shareGem(gem);
    onClose();
  };

  return (
    <Sheet title="Share a hidden gem" onClose={onClose} footer={<Button className="w-full" icon={Gem} disabled={!valid} onClick={submit}>Share gem · +{XP.shareGem} XP</Button>}>
      <div className="space-y-5">
        <Field label="Place name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Valbona Valley" /></Field>
        <Field label="Country">
          <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Choose a country</option>
            {COUNTRY_NAMES.map((c) => <option key={c} value={c}>{prettyCountry(c)}</option>)}
          </select>
        </Field>
        <Field group label="Location" hint={coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : "Without it we'll pin the gem near similar places in that country."}>
          <Button variant="ghost" icon={MapPin} onClick={locate} disabled={locating}>{coords ? "Location set" : locating ? "Locating…" : "Use my current location"}</Button>
        </Field>
        <Field label="Why it's special"><input className={inputCls} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Alpine meadows with zero crowds" /></Field>
        <Field label="Insider tip"><textarea className={cx(inputCls, "min-h-[80px] resize-none")} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Take the morning ferry across Koman Lake…" /></Field>
        <Field group label="Landscape">
          <div className="flex flex-wrap gap-2">{(Object.keys(SCENE_PALETTES) as SceneKind[]).map((k) => <Chip key={k} active={kind === k} onClick={() => setKind(k)} className="capitalize">{k}</Chip>)}</div>
        </Field>
        <Field group label="Good for">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STYLE_META) as TravelStyle[]).map((st) => (
              <Chip key={st} active={styles.includes(st)} onClick={() => setStyles(styles.includes(st) ? styles.filter((x) => x !== st) : [...styles, st])}>{STYLE_META[st].label}</Chip>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function AddTipSheet({ onClose, destinationId }: { onClose: () => void; destinationId: string }) {
  const addNote = useApp((s) => s.addNote);
  const handle = useApp((s) => s.profile!.handle);
  const [category, setCategory] = useState("Local secret");
  const [text, setText] = useState("");
  const d = destinationById(destinationId);
  return (
    <Sheet
      title={`Field note · ${d?.name}`}
      onClose={onClose}
      footer={<Button className="w-full" icon={Lightbulb} disabled={text.trim().length < 10} onClick={() => { addNote({ destinationId, category, author: `@${handle}`, text: text.trim() }); onClose(); }}>Publish · +{XP.submitTip} XP</Button>}
    >
      <div className="space-y-5">
        <Field group label="Category">
          <div className="flex flex-wrap gap-2">
            {["Local secret", "Transit", "Food", "Timing", "Gear", "Money", "Safety"].map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
          </div>
        </Field>
        <Field label="Your tip" hint="Specific beats general: times, places, prices.">
          <textarea autoFocus className={cx(inputCls, "min-h-[120px] resize-none")} value={text} onChange={(e) => setText(e.target.value)} placeholder="Arrive before 7 AM and take the north path…" />
        </Field>
      </div>
    </Sheet>
  );
}

function AddStopSheet({ onClose }: { onClose: () => void }) {
  const addStop = useApp((s) => s.addStop);
  const [time, setTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("Explore");
  return (
    <Sheet
      title="Add a stop"
      onClose={onClose}
      footer={<Button className="w-full" icon={CirclePlus} disabled={!title.trim()} onClick={() => { addStop({ time, title: title.trim(), description: description.trim(), tag }); onClose(); }}>Add to day</Button>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Time"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Title"><input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kinkaku-ji" /></Field>
        </div>
        <Field label="Notes"><textarea className={cx(inputCls, "min-h-[80px] resize-none")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tickets at the gate, 500 yen" /></Field>
        <Field group label="Type">
          <div className="flex flex-wrap gap-2">{["Explore", "Food", "Culture & History", "Photography", "Hike", "Event", "Nightlife", "Transit"].map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}</div>
        </Field>
      </div>
    </Sheet>
  );
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const s = useApp();
  const p = s.profile!;
  const [draft, setDraft] = useState<Profile>(p);
  const [q, setQ] = useState("");
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const countries = useMemo(() => COUNTRY_NAMES.filter((c) => !draft.visited.includes(c) && prettyCountry(c).toLowerCase().includes(q.toLowerCase())).slice(0, 16), [q, draft.visited]);

  const save = () => {
    const newCountries = draft.visited.filter((c) => !p.visited.includes(c)).length;
    const { socials, ...rest } = draft;
    s.updateProfile({ ...rest });
    s.setSocials(socials);
    if (newCountries) s.award(newCountries * XP.addVisitedCountry, `${newCountries} new passport stamp${newCountries > 1 ? "s" : ""}`);
    onClose();
  };

  return (
    <Sheet title="Edit dossier" onClose={onClose} footer={<Button className="w-full" icon={Check} disabled={!draft.name.trim()} onClick={save}>Save changes</Button>}>
      <div className="space-y-5">
        <Field label="Name"><input className={inputCls} value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Home base"><input className={inputCls} value={draft.home} onChange={(e) => set({ home: e.target.value })} /></Field>
        <Field label="Bio"><textarea className={cx(inputCls, "min-h-[80px] resize-none")} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} /></Field>
        <Field group label="Travel styles">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STYLE_META) as TravelStyle[]).map((st) => (
              <Chip key={st} icon={STYLE_META[st].icon} active={draft.styles.includes(st)} onClick={() => set({ styles: draft.styles.includes(st) ? draft.styles.filter((x) => x !== st) : [...draft.styles, st] })}>{STYLE_META[st].label}</Chip>
            ))}
          </div>
        </Field>
        <Field group label={`Countries visited (${draft.visited.length})`}>
          <div className="mb-2 flex flex-wrap gap-2">
            {draft.visited.map((c) => <Chip key={c} active icon={Check} onClick={() => set({ visited: draft.visited.filter((x) => x !== c) })}>{prettyCountry(c)}</Chip>)}
          </div>
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a country…" />
          {q && <div className="mt-2 flex flex-wrap gap-2">{countries.map((c) => <Chip key={c} onClick={() => { set({ visited: [...draft.visited, c] }); setQ(""); }}>{prettyCountry(c)}</Chip>)}</div>}
        </Field>
        <div className="space-y-3">
          <span className="eyebrow block text-muted">Social profiles</span>
          {(["instagram", "x", "tiktok", "strava"] as (keyof SocialLinks)[]).map((k) => (
            <div key={k} className="relative">
              <span className="absolute top-1/2 left-4 w-20 -translate-y-1/2 text-[12px] font-bold text-muted capitalize">{k === "x" ? "X" : k}</span>
              <input className={cx(inputCls, "pl-24")} value={draft.socials[k] ?? ""} placeholder="handle" onChange={(e) => set({ socials: { ...draft.socials, [k]: e.target.value.replace(/^@/, "") || undefined } })} />
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function XpLogSheet({ onClose }: { onClose: () => void }) {
  const log = useApp((s) => s.xpLog);
  const ways: [string, number][] = [
    ["Share a hidden gem", XP.shareGem], ["Plan a trip", XP.createTrip], ["Create a group", XP.createGroup], ["Publish a field note", XP.submitTip],
    ["Join a group", XP.joinGroup], ["Connect a social account", XP.connectSocial], ["Stamp a country", XP.addVisitedCountry], ["Check in at a stop", XP.completeStop],
  ];
  return (
    <Sheet title="Explorer points" onClose={onClose}>
      <h3 className="eyebrow text-accent">Ways to earn</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ways.map(([l, n]) => (
          <div key={l} className="rounded-2xl bg-card p-3 text-[12.5px] font-semibold shadow-sm">{l}<div className="mt-0.5 font-bold text-green">+{n} XP</div></div>
        ))}
      </div>
      <h3 className="eyebrow mt-6 text-accent">Recent activity</h3>
      <div className="mt-2 divide-y divide-line rounded-2xl bg-card shadow-sm">
        {log.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3 text-[13.5px]">
            <span className="truncate">{e.label}</span>
            <span className="shrink-0 font-bold text-green">+{e.amount}</span>
          </div>
        ))}
        {log.length === 0 && <div className="p-4 text-center text-sm text-muted">No points yet.</div>}
      </div>
    </Sheet>
  );
}
