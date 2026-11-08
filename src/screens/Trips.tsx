import { useMemo, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Bookmark, Check, ChevronRight, CirclePlus, Gem as GemIcon, ListChecks,
  MapPin, Plus, Share2, Sparkles, Ticket, Trash2,
} from "lucide-react";
import { useDestinations, useDeleteTrip, useEvents, useGems, useMe, useSaves, useTripItemMutations, useTripItems, useTrips } from "../api/hooks";
import { useUi } from "../store/ui";
import { Button, Card, Tag, TRIP_STYLE_META } from "../components/ui";
import { Scene } from "../components/Scene";
import { SignInPrompt } from "./SignInPrompt";
import { suggest } from "../lib/suggest";
import { addDays, cx, fmtDayLong, fmtRange, prettyCountry, shareText } from "../lib/util";
import type { ItemType, Trip, TripItem } from "../types";
import { useTranslation } from "react-i18next";
import { reasonText } from "../i18n/reason";

export function Trips() {
  const user = useUi((s) => s.user);
  const { data: trips = [], isLoading } = useTrips();
  const activeTripId = useUi((s) => s.activeTripId);
  const setActive = useUi((s) => s.setActiveTrip);
  const open = useUi((s) => s.open);
  const { t } = useTranslation();

  if (!user) return <SignInPrompt icon={ListChecks} title={t("trips.promptTitle")} body={t("trips.promptBody")} />;
  const active = trips.find((t) => t.id === activeTripId);
  if (active) return <TripBuilder key={active.id} trip={active} onBack={() => setActive(null)} />;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[30px] font-semibold">{t("trips.title")}</h1>
          <p className="text-[14px] text-muted">{trips.length ? t("trips.planned", { count: trips.length }) : t("trips.planFirst")}</p>
        </div>
        <Button icon={Plus} className="px-4 py-2.5" onClick={() => open({ type: "newTrip" })}>{t("trips.newTrip")}</Button>
      </div>
      {isLoading && <div className="h-28 animate-pulse rounded-3xl bg-card" />}
      {!isLoading && trips.length === 0 && (
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><ListChecks size={28} /></div>
          <h2 className="font-display mt-4 text-[22px] font-semibold">{t("trips.emptyTitle")}</h2>
          <p className="mx-auto mt-1 max-w-[290px] text-[14px] text-muted">{t("trips.emptyBody")}</p>
          <Button className="mt-4" icon={CirclePlus} onClick={() => open({ type: "newTrip" })}>{t("trips.planTrip")}</Button>
        </Card>
      )}
      {trips.map((t) => <TripCard key={t.id} trip={t} onOpen={() => setActive(t.id)} />)}
    </div>
  );
}

function TripCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const { data: destinations = [] } = useDestinations();
  const d = destinations.find((x) => x.id === trip.destinationId);
  const { t } = useTranslation();
  return (
    <Card className="flex items-center gap-3 overflow-hidden p-0" onClick={onOpen}>
      <div className="h-24 w-24 shrink-0">{d ? <Scene scene={d.scene} /> : <div className="h-full bg-chip" />}</div>
      <div className="min-w-0 flex-1 py-3">
        <div className="eyebrow text-muted">{t("trips.days", { count: trip.days })}{trip.startDate ? ` · ${fmtRange(trip.startDate, addDays(trip.startDate, trip.days - 1))}` : ""}</div>
        <div className="truncate text-[17px] font-bold">{trip.title}</div>
        <div className="truncate text-[12.5px] text-muted">{d ? `${d.name}, ${prettyCountry(d.country)}` : t("common.anywhere")} · {t(`tripStyles.${trip.style}.label`)}</div>
      </div>
      <ChevronRight size={18} className="mr-3 text-muted" />
    </Card>
  );
}

interface Candidate {
  itemType: ItemType;
  itemId: string;
  title: string;
  sub: string;
  reason?: string;
}

function TripBuilder({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const { data: items = [], isLoading } = useTripItems(trip.id);
  const { data: destinations = [] } = useDestinations();
  const { data: gems = [] } = useGems();
  const { data: events = [] } = useEvents();
  const { data: saves = [] } = useSaves();
  const { data: me } = useMe();
  const { add, update, remove } = useTripItemMutations(trip.id);
  const del = useDeleteTrip();
  const open = useUi((s) => s.open);
  const [day, setDay] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shared, setShared] = useState(false);
  const d = destinations.find((x) => x.id === trip.destinationId);
  const { t } = useTranslation();

  const dayItems = items.filter((i) => i.day === day).sort((a, b) => a.position - b.position);
  const inTrip = new Set(items.filter((i) => i.itemId).map((i) => `${i.itemType}:${i.itemId}`));
  const done = items.filter((i) => i.done).length;

  const describe = (type: ItemType, id: string): Candidate | null => {
    if (type === "gem") {
      const g = gems.find((x) => x.id === id);
      return g ? { itemType: "gem", itemId: g.id, title: g.name, sub: t("trips.hiddenGem") } : null;
    }
    if (type === "event") {
      const e = events.find((x) => x.id === id);
      return e ? { itemType: "event", itemId: e.id, title: e.title, sub: t("trips.happeningIn", { city: e.city }) } : null;
    }
    return null;
  };
  const belongsHere = (type: ItemType, id: string) => {
    if (!trip.destinationId) return true;
    if (type === "gem") return gems.find((g) => g.id === id)?.destinationId === trip.destinationId;
    if (type === "event") return events.find((e) => e.id === id)?.destinationId === trip.destinationId;
    return false;
  };

  const fromSaves = saves
    .filter((s) => s.itemType !== "destination" && !inTrip.has(`${s.itemType}:${s.itemId}`))
    .sort((a, b) => Number(belongsHere(b.itemType, b.itemId)) - Number(belongsHere(a.itemType, a.itemId)))
    .map((s) => describe(s.itemType, s.itemId))
    .filter((x): x is Candidate => !!x)
    .slice(0, 8);

  const suggestions = useMemo(() => {
    const local = {
      profile: me ?? null,
      saves,
      destinations: [],
      gems: gems.filter((g) => !trip.destinationId || g.destinationId === trip.destinationId),
      events: events.filter((e) => !trip.destinationId || e.destinationId === trip.destinationId),
    };
    return suggest(local, 12)
      .filter((s) => !inTrip.has(`${s.itemType}:${s.id}`) && !saves.some((x) => x.itemType === s.itemType && x.itemId === s.id))
      .map((s): Candidate | null => {
        const c = describe(s.itemType, s.id);
        return c ? { ...c, reason: reasonText(t, s.reasons[0]) } : null;
      })
      .filter((x): x is Candidate => !!x)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, saves, gems, events, items, trip.destinationId]);

  const addCandidate = (c: Candidate) =>
    add.mutate([{ day, position: dayItems.length, time: null, title: c.title, notes: "", itemType: c.itemType, itemId: c.itemId }]);

  // Reorder by renumbering the whole day, so duplicate positions can never stick.
  const move = (it: TripItem, dir: -1 | 1) => {
    const order = [...dayItems];
    const idx = order.findIndex((x) => x.id === it.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    order.forEach((x, k) => x.position !== k && update.mutate({ id: x.id, patch: { position: k } }));
  };
  const moveToDay = (it: TripItem, target: number) =>
    update.mutate({ id: it.id, patch: { day: target, position: items.filter((x) => x.day === target).length } });

  const share = async () => {
    const lines = [`${trip.title}${trip.startDate ? ` (${fmtRange(trip.startDate, addDays(trip.startDate, trip.days - 1))})` : ""}`, ""];
    for (let i = 0; i < trip.days; i++) {
      const di = items.filter((x) => x.day === i).sort((a, b) => a.position - b.position);
      if (!di.length) continue;
      lines.push(t("common.dayN", { n: i + 1 }));
      di.forEach((x) => lines.push(`  ${x.time ? x.time + " " : ""}${x.title}`));
      lines.push("");
    }
    lines.push(t("trips.plannedWith"));
    if (await shareText(trip.title, lines.join("\n"))) {
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-bold text-muted"><ArrowLeft size={16} /> {t("trips.allTrips")}</button>

      <Card className="overflow-hidden">
        <div className="relative h-28">
          {d ? <Scene scene={d.scene} /> : <div className="h-full bg-chip" />}
          <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
          <div className="absolute right-4 bottom-3 left-4 text-white">
            <div className="eyebrow">{t("trips.days", { count: trip.days })}{trip.startDate ? ` · ${fmtRange(trip.startDate, addDays(trip.startDate, trip.days - 1))}` : ""}</div>
            <h1 className="font-display truncate text-[24px] leading-tight font-semibold">{trip.title}</h1>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {d && <button onClick={() => open({ type: "destination", id: d.id })}><Tag icon={MapPin}>{d.name}</Tag></button>}
            <Tag icon={TRIP_STYLE_META[trip.style].icon}>{t(`tripStyles.${trip.style}.label`)}</Tag>
          </div>
          <div>
            <div className="flex justify-between text-[12px] font-semibold text-muted"><span>{t("trips.progress")}</span><span>{t("trips.stopsDone", { done, total: items.length })}</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chip">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <section>
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
          {Array.from({ length: trip.days }, (_, i) => {
            const n = items.filter((x) => x.day === i).length;
            return (
              <button key={i} onClick={() => setDay(i)} aria-pressed={i === day} className={cx("shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-bold", i === day ? "bg-accent text-white" : "bg-card text-muted")}>
                {t("common.dayN", { n: i + 1 })}{n ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
        <h2 className="font-display mt-4 text-[24px] font-semibold">{t("common.dayN", { n: day + 1 })}</h2>
        {trip.startDate && <p className="text-[13px] text-muted">{fmtDayLong(addDays(trip.startDate, day))}</p>}

        <ol className="relative mt-4 space-y-3 pl-6">
          <span className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-line" aria-hidden />
          {isLoading && <li className="h-20 animate-pulse rounded-3xl bg-card" />}
          {dayItems.map((it, i) => (
            <li key={it.id} className="relative">
              <span className={cx("absolute top-5 -left-6 grid h-4 w-4 place-items-center rounded-full ring-4 ring-bg", it.done ? "bg-green" : "border border-line bg-card")}>
                {it.done && <Check size={10} className="text-white" />}
              </span>
              <Card className={cx("p-4", it.done && "opacity-70")}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="eyebrow flex items-center gap-1 text-accent">
                      {it.time ?? t("trips.anytime")}
                      {it.itemType === "gem" && <span className="flex items-center gap-1 text-coral"> · <GemIcon size={11} /> {t("trips.gem")}</span>}
                      {it.itemType === "event" && <span className="flex items-center gap-1 text-[#7C5CFF]"> · <Ticket size={11} /> {t("trips.happening")}</span>}
                    </div>
                    <button
                      disabled={!it.itemType || !it.itemId}
                      onClick={() => it.itemType && it.itemId && open({ type: it.itemType, id: it.itemId })}
                      className={cx("mt-1 text-left text-[16px] leading-snug font-bold", it.done && "line-through")}
                    >
                      {it.title}
                    </button>
                    {it.notes && <p className="mt-1 text-[13px] text-muted">{it.notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button aria-label={t("trips.moveUp")} disabled={i === 0} onClick={() => move(it, -1)} className="grid h-7 w-7 place-items-center rounded-full disabled:opacity-25 hover:bg-chip"><ArrowUp size={15} /></button>
                    <button aria-label={t("trips.moveDown")} disabled={i === dayItems.length - 1} onClick={() => move(it, 1)} className="grid h-7 w-7 place-items-center rounded-full disabled:opacity-25 hover:bg-chip"><ArrowDown size={15} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <button onClick={() => update.mutate({ id: it.id, patch: { done: !it.done } })} className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] font-bold", it.done ? "bg-mint text-green" : "bg-chip")}>
                    <Check size={14} /> {it.done ? t("trips.checkedIn") : t("trips.checkIn")}
                  </button>
                  {trip.days > 1 && (
                    <select aria-label={t("trips.moveToDay")} value={it.day} onChange={(e) => moveToDay(it, Number(e.target.value))} className="rounded-full bg-chip px-2 py-2 text-[12px] font-bold outline-none">
                      {Array.from({ length: trip.days }, (_, k) => <option key={k} value={k}>{t("common.dayN", { n: k + 1 })}</option>)}
                    </select>
                  )}
                  <button aria-label={t("trips.remove", { name: it.title })} onClick={() => remove.mutate(it.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-chip hover:text-accent"><Trash2 size={15} /></button>
                </div>
              </Card>
            </li>
          ))}
          {!isLoading && dayItems.length === 0 && (
            <li className="rounded-3xl border border-dashed border-line p-5 text-center text-[13.5px] text-muted">{t("trips.emptyDay")}</li>
          )}
        </ol>

        <div className="mt-4 flex gap-2 rounded-[22px] bg-chip p-2">
          <Button variant="ghost" className="flex-1 px-3" icon={CirclePlus} onClick={() => open({ type: "addStop", tripId: trip.id, day })}>{t("trips.customStop")}</Button>
          <button aria-label={t("trips.share")} onClick={share} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card">
            {shared ? <Check size={17} className="text-green" /> : <Share2 size={17} />}
          </button>
        </div>
      </section>

      <CandidateList icon={Bookmark} title={t("trips.fromSaves")} empty={saves.some((s) => s.itemType !== "destination") ? t("trips.allSavedInTrip") : t("trips.saveFirst")} items={fromSaves} onAdd={addCandidate} day={day} />
      <CandidateList icon={Sparkles} title={d ? t("trips.suggestedIn", { place: d.name }) : t("trips.suggested")} empty={t("trips.noSuggestions")} items={suggestions} onAdd={addCandidate} day={day} />

      <div className="pt-2">
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-2 text-[13px]">
            <span className="font-semibold">{t("trips.confirmDelete")}</span>
            <button onClick={() => del.mutate(trip.id, { onSuccess: onBack })} className="rounded-full bg-accent px-3 py-1.5 font-bold text-white">{t("common.delete")}</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-full bg-chip px-3 py-1.5 font-bold">{t("common.cancel")}</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="mx-auto flex items-center gap-1.5 text-[13px] font-bold text-muted hover:text-accent"><Trash2 size={14} /> {t("trips.deleteTrip")}</button>
        )}
      </div>
    </div>
  );
}

function CandidateList({ icon: Icon, title, empty, items, onAdd, day }: { icon: typeof Bookmark; title: string; empty: string; items: Candidate[]; onAdd: (c: Candidate) => void; day: number }) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[17px] font-bold"><Icon size={17} className="text-accent" /> {title}</h3>
      <div className="mt-2 space-y-2">
        {items.map((c) => (
          <Card key={`${c.itemType}:${c.itemId}`} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-bold">{c.title}</div>
              <div className="truncate text-[12px] text-muted">{c.sub}{c.reason ? <span className="text-green"> · {c.reason}</span> : null}</div>
            </div>
            <button onClick={() => onAdd(c)} aria-label={t("trips.addToDay", { name: c.title, n: day + 1 })} className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-white">
              <Plus size={13} /> {t("common.dayN", { n: day + 1 })}
            </button>
          </Card>
        ))}
        {items.length === 0 && <p className="rounded-2xl bg-chip p-3 text-[13px] text-muted">{empty}</p>}
      </div>
    </section>
  );
}

