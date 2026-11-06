import { useState } from "react";
import {
  Calendar, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, CirclePlus, Footprints, Lightbulb, ListChecks,
  Plane, Radar, Share2, ShieldCheck, Siren, ThumbsUp, Trash2, WandSparkles, PartyPopper, Sun, Plus,
} from "lucide-react";
import { useActiveTrip, useApp } from "../store/useApp";
import { destinationById } from "../data/destinations";
import { FIELD_NOTES, NEWS } from "../data/community";
import { Button, Card, Chip, Tag, TRIP_STYLE_META } from "../components/ui";
import { Scene } from "../components/Scene";
import { addDays, cx, fmtDayLong, fmtRange, prettyCountry } from "../lib/util";
import type { Stop, TripStyle } from "../types";
import { XP } from "../lib/progress";

export function Itinerary() {
  const trip = useActiveTrip();
  const trips = useApp((s) => s.trips);
  const open = useApp((s) => s.open);

  if (!trip) {
    return (
      <div className="pt-10 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-accent"><ListChecks size={34} /></div>
        <h1 className="font-display mt-5 text-[28px] font-semibold">No trips yet</h1>
        <p className="mx-auto mt-2 max-w-[280px] text-sm text-muted">Pick a destination and a style — we'll draft a day-by-day plan you can tweak.</p>
        <Button className="mt-6" icon={CirclePlus} onClick={() => open({ type: "newTrip" })}>Plan a trip</Button>
      </div>
    );
  }
  return <TripView key={trip.id} tripCount={trips.length} />;
}

function TripView({ tripCount }: { tripCount: number }) {
  const trip = useActiveTrip()!;
  const d = destinationById(trip.destinationId)!;
  const trips = useApp((s) => s.trips);
  const setActiveTrip = useApp((s) => s.setActiveTrip);
  const dayIdx = useApp((s) => Math.min(s.activeDay, trip.days.length - 1));
  const setDay = useApp((s) => s.setActiveDay);
  const open = useApp((s) => s.open);
  const regenerate = useApp((s) => s.regenerateDay);
  const createTrip = useApp((s) => s.createTrip);
  const deleteTrip = useApp((s) => s.deleteTrip);
  const watching = useApp((s) => s.profile!.watching.includes(d.id));
  const toggleWatch = useApp((s) => s.toggleWatch);
  const [switcher, setSwitcher] = useState(false);
  const [shared, setShared] = useState(false);

  const day = trip.days[dayIdx];
  const date = addDays(trip.startDate, dayIdx);
  const end = addDays(trip.startDate, trip.days.length - 1);
  const news = NEWS.filter((n) => n.destinationId === d.id).slice(0, 2);
  const doneCount = trip.days.flatMap((x) => x.stops).filter((s) => s.done).length;
  const totalCount = trip.days.flatMap((x) => x.stops).length;

  const share = async () => {
    const text = `${trip.title} — ${fmtRange(trip.startDate, end)}\n\n` +
      trip.days.map((dy, i) => `Day ${i + 1}: ${dy.title}\n` + dy.stops.map((s) => `  ${s.time} ${s.title}`).join("\n")).join("\n\n");
    try {
      if (navigator.share) await navigator.share({ title: trip.title, text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch { /* user cancelled */ }
  };

  const restyle = (style: TripStyle) => {
    if (style === trip.style) return;
    if (!confirm(`Re-plan "${trip.title}" as a ${TRIP_STYLE_META[style].label} trip? Your current stops will be replaced.`)) return;
    deleteTrip(trip.id);
    createTrip(trip.destinationId, style, trip.startDate, trip.days.length, trip.title);
  };

  return (
    <div className="space-y-7 pb-4">
      {/* Active expedition header */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-1.5 text-accent"><Plane size={14} /> Active expeditions</span>
          <button onClick={() => open({ type: "newTrip" })} className="flex items-center gap-1 rounded-full bg-card px-3 py-1 text-[12px] font-bold shadow-sm">
            <Plus size={13} /> New trip
          </button>
        </div>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="eyebrow text-muted">{trip.days.length} days • {fmtRange(trip.startDate, end)}</div>
              <h1 className="font-display mt-1 text-[24px] leading-tight font-semibold">{trip.title}</h1>
            </div>
            {tripCount > 1 && (
              <button aria-label="Switch trip" onClick={() => setSwitcher(!switcher)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line">
                <ChevronsUpDown size={17} />
              </button>
            )}
          </div>
          {switcher && (
            <div className="mt-3 space-y-1 rounded-2xl bg-chip p-1.5">
              {trips.map((t) => (
                <button key={t.id} onClick={() => { setActiveTrip(t.id); setSwitcher(false); }} className={cx("flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold", t.id === trip.id && "bg-card shadow-sm")}>
                  {t.title}
                  <span className="text-xs text-muted">{fmtRange(t.startDate, addDays(t.startDate, t.days.length - 1))}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Sun size={19} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">{d.name}, {prettyCountry(d.country)}</div>
              <div className="truncate text-[12.5px] text-muted">Best: {d.bestTime}</div>
            </div>
            <button onClick={() => toggleWatch(d.id)} className={cx("flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase", watching ? "bg-accent-soft text-accent" : "bg-chip")}>
              <Radar size={13} /> {watching ? "Watching" : "Watch"}
            </button>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[12px] font-semibold text-muted">
              <span>Trip progress</span><span>{doneCount}/{totalCount} stops</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chip">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
            </div>
          </div>
        </Card>
      </section>

      {/* Style lens */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow text-ink/80">Travel style lens</span>
          <span className="text-[12px] font-bold text-accent">Re-plans the trip</span>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {(Object.keys(TRIP_STYLE_META) as TripStyle[]).map((s) => (
            <Chip key={s} active={trip.style === s} icon={TRIP_STYLE_META[s].icon} onClick={() => restyle(s)} className={trip.style === s ? "!bg-navy" : ""}>
              {TRIP_STYLE_META[s].label}
            </Chip>
          ))}
        </div>
      </section>

      {/* Destination radar */}
      {news.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[19px] font-bold"><Radar size={19} className="text-accent" /> Destination Radar</h2>
            <span className="eyebrow text-muted">Live {d.name} feed</span>
          </div>
          <div className="space-y-3">
            {news.map((n) => (
              <Card key={n.id} className="flex gap-3 p-4">
                <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", n.kind === "alert" ? "bg-coral text-white" : n.kind === "intel" ? "bg-mint text-green" : "bg-accent-soft text-accent")}>
                  {n.kind === "alert" ? <Siren size={20} /> : n.kind === "intel" ? <ShieldCheck size={20} /> : <PartyPopper size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Tag tone={n.kind === "alert" ? "accent" : n.kind === "intel" ? "neutral" : "accent"}>{n.kind === "alert" ? "News alert" : n.kind === "intel" ? "Verified local intel" : "Event"}</Tag>
                    <span className="text-[11.5px] font-semibold text-muted">{n.match ? <span className="text-green">{n.match}% match</span> : `${n.hoursAgo}h ago`}</span>
                  </div>
                  <div className="mt-1.5 text-[14.5px] leading-snug font-bold">{n.title}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted">{n.body}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Day plan */}
      <section>
        <div className="eyebrow text-accent">Selected itinerary</div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[26px] leading-tight font-semibold">Day {dayIdx + 1} • {day.title}</h2>
            <p className="mt-1 text-[13px] text-muted">{fmtDayLong(date)} • {day.stops.length} curated milestones</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-card p-1 shadow-sm">
            <button aria-label="Previous day" disabled={dayIdx === 0} onClick={() => setDay(dayIdx - 1)} className="grid h-8 w-8 place-items-center rounded-xl disabled:opacity-30"><ChevronLeft size={17} /></button>
            <div className="flex items-center gap-1 text-[12px] font-bold"><Calendar size={13} /> {dayIdx + 1}/{trip.days.length}</div>
            <button aria-label="Next day" disabled={dayIdx === trip.days.length - 1} onClick={() => setDay(dayIdx + 1)} className="grid h-8 w-8 place-items-center rounded-xl disabled:opacity-30"><ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
          {trip.days.map((_, i) => (
            <button key={i} onClick={() => setDay(i)} className={cx("shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-bold", i === dayIdx ? "bg-accent text-white" : "bg-card text-muted")}>
              Day {i + 1}
            </button>
          ))}
        </div>

        <ol className="relative mt-5 space-y-4 pl-7">
          <span className="absolute top-2 bottom-2 left-[9px] w-0.5 bg-line" aria-hidden />
          {day.stops.map((s, i) => <StopCard key={s.id} s={s} first={i === 0} seed={i + dayIdx} />)}
          {day.stops.length === 0 && <li className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-muted">Nothing planned — add a stop below.</li>}
        </ol>

        <div className="mt-5 flex gap-2 rounded-[22px] bg-chip p-2">
          <Button variant="ghost" className="flex-1 px-3" icon={CirclePlus} onClick={() => open({ type: "addStop" })}>Add Stop</Button>
          <Button className="flex-1 px-3" icon={WandSparkles} onClick={regenerate}>Re-plan day</Button>
          <button aria-label="Share itinerary" onClick={share} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card">
            {shared ? <Check size={17} className="text-green" /> : <Share2 size={17} />}
          </button>
        </div>
      </section>

      <FieldNotes destinationId={d.id} />
    </div>
  );
}

function StopCard({ s, first, seed }: { s: Stop; first: boolean; seed: number }) {
  const toggleDone = useApp((st) => st.toggleStopDone);
  const remove = useApp((st) => st.removeStop);
  const trip = useActiveTrip()!;
  const d = destinationById(trip.destinationId)!;
  const [revealed, setRevealed] = useState(false);

  return (
    <li className="relative">
      <span className={cx("absolute top-5 -left-7 grid h-5 w-5 place-items-center rounded-full ring-4 ring-bg", s.done ? "bg-green" : first ? "bg-accent" : "bg-card border border-line")}>
        {s.done ? <Check size={12} className="text-white" /> : first ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <Card className={cx("p-4", s.done && "opacity-70")}>
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow text-accent">{s.time}{s.label ? ` • ${s.label}` : ""}</span>
          {s.reserved ? <Tag tone="accent" icon={Check}>Reserved</Tag> : <Tag>{s.tag}</Tag>}
        </div>
        <div className="mt-2 flex gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cx("text-[18px] leading-snug font-bold", s.done && "line-through")}>{s.title}</h3>
            <p className="mt-1 text-[13px] text-muted">{s.description}</p>
          </div>
          <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl"><Scene scene={s.scene ?? d.scene} seed={seed * 3 + 1} /></div>
        </div>
        {s.secret && (
          <button onClick={() => setRevealed(true)} className="mt-3 block w-full rounded-2xl bg-accent-soft p-3 text-left">
            <div className="flex items-center justify-between">
              <span className="eyebrow flex items-center gap-1.5 text-accent"><Lightbulb size={14} /> Explorer secret</span>
              <span className="text-[11px] font-bold text-accent">+{XP.completeStop} PTS</span>
            </div>
            <p className={cx("mt-1 text-[13px] font-medium transition", !revealed && "blur-[5px] select-none")}>{s.secret}</p>
            {!revealed && <span className="mt-1 block text-[11.5px] font-bold text-accent">Tap to reveal</span>}
          </button>
        )}
        {s.reserved && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-chip px-3 py-2.5 text-[12.5px] font-semibold">
            {s.reserved}
            <span className="text-[11px] font-bold text-accent uppercase">Confirmed</span>
          </div>
        )}
        {s.transit && (
          <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted"><Footprints size={14} className="text-accent" /> {s.transit}</div>
        )}
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <button onClick={() => toggleDone(s.id)} className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] font-bold", s.done ? "bg-mint text-green" : "bg-chip")}>
            <Check size={14} /> {s.done ? "Checked in" : `Check in · +${XP.completeStop}`}
          </button>
          <button aria-label="Remove stop" onClick={() => remove(s.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-chip hover:text-accent">
            <Trash2 size={15} />
          </button>
        </div>
      </Card>
    </li>
  );
}

export function FieldNotes({ destinationId }: { destinationId: string }) {
  const mine = useApp((s) => s.notes);
  const upvoted = useApp((s) => s.upvoted);
  const toggleUpvote = useApp((s) => s.toggleUpvote);
  const open = useApp((s) => s.open);
  const notes = [...mine, ...FIELD_NOTES]
    .filter((n) => n.destinationId === destinationId)
    .map((n) => ({ ...n, votes: n.votes + (upvoted.includes(n.id) ? 1 : 0) }))
    .sort((a, b) => b.votes - a.votes);

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-[24px] font-semibold">Traveller Field Notes</h2>
          <p className="text-[12.5px] text-muted">Voted by explorers who completed this path</p>
        </div>
        <button onClick={() => open({ type: "addTip", destinationId })} className="flex items-center gap-1 pb-1 text-[13px] font-bold text-accent">
          <Plus size={14} /> Add note
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {notes.map((n) => {
          const v = upvoted.includes(n.id);
          return (
            <Card key={n.id} className="flex gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="eyebrow text-accent">{n.category} <span className="text-muted normal-case">• by {n.mine ? "you" : n.author}</span></div>
                <p className="mt-1.5 text-[13.5px]">"{n.text}"</p>
              </div>
              <button onClick={() => toggleUpvote(n.id)} aria-pressed={v} aria-label="Upvote" className={cx("flex h-fit flex-col items-center rounded-xl border px-2.5 py-1.5 text-[12px] font-bold", v ? "border-accent bg-accent-soft text-accent" : "border-line")}>
                <ChevronUp size={15} /> {n.votes}
              </button>
            </Card>
          );
        })}
        {notes.length === 0 && (
          <button onClick={() => open({ type: "addTip", destinationId })} className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line p-6 text-sm font-semibold text-muted">
            <ThumbsUp size={16} /> Be the first to leave a field note (+{XP.submitTip} XP)
          </button>
        )}
      </div>
    </section>
  );
}
