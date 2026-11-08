import { Bookmark, CalendarPlus, Compass, Gem as GemIcon, MapPin, Ticket, Route } from "lucide-react";
import { useDestinations, useEvents, useGems, useSaves } from "../api/hooks";
import { useUi, type TripSeedItem } from "../store/ui";
import { Button, Card } from "../components/ui";
import { GemImage, SaveButton } from "../components/Cards";
import { Scene } from "../components/Scene";
import { SignInPrompt } from "./SignInPrompt";
import { fmtEventDate, prettyCountry } from "../lib/util";
import type { Destination, Gem, ItemType, PulseEvent } from "../types";
import { useTranslation } from "react-i18next";

interface Row {
  itemType: ItemType;
  itemId: string;
  title: string;
  sub: string;
  gem?: Gem;
  event?: PulseEvent;
  dest?: Destination;
}

/** Saved places grouped by destination, each group one tap away from a trip. */
export function Saved() {
  const user = useUi((s) => s.user);
  const { data: saves = [], isLoading } = useSaves();
  const { data: destinations = [] } = useDestinations();
  const { data: gems = [] } = useGems();
  const { data: events = [] } = useEvents();
  const open = useUi((s) => s.open);
  const setTab = useUi((s) => s.setTab);
  const { t } = useTranslation();

  if (!user) return <SignInPrompt icon={Bookmark} title={t("saved.promptTitle")} body={t("saved.promptBody")} />;

  const groups = new Map<string, { dest?: Destination; rows: Row[] }>();
  const push = (key: string, dest: Destination | undefined, row: Row) => {
    if (!groups.has(key)) groups.set(key, { dest, rows: [] });
    groups.get(key)!.rows.push(row);
  };
  for (const s of saves) {
    if (s.itemType === "destination") {
      const d = destinations.find((x) => x.id === s.itemId);
      if (d) push(d.id, d, { itemType: "destination", itemId: d.id, title: d.name, sub: d.tagline, dest: d });
    } else if (s.itemType === "gem") {
      const g = gems.find((x) => x.id === s.itemId);
      if (!g) continue;
      const d = destinations.find((x) => x.id === g.destinationId);
      push(d?.id ?? `country:${g.country}`, d, { itemType: "gem", itemId: g.id, title: g.name, sub: t("saved.gemSub", { country: prettyCountry(g.country) }), gem: g });
    } else {
      const e = events.find((x) => x.id === s.itemId);
      if (!e) continue;
      const d = destinations.find((x) => x.id === e.destinationId);
      push(d?.id ?? `city:${e.city}`, d, { itemType: "event", itemId: e.id, title: e.title, sub: `${e.city} · ${fmtEventDate(e.startsAt, e.endsAt)}`, event: e });
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="font-display text-[30px] font-semibold">{t("saved.title")}</h1>
        <p className="text-[14px] text-muted">{t("saved.subtitle", { count: saves.length })}</p>
      </div>

      {isLoading && <div className="h-40 animate-pulse rounded-3xl bg-card" />}
      {!isLoading && saves.length === 0 && (
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><Bookmark size={28} /></div>
          <h2 className="font-display mt-4 text-[22px] font-semibold">{t("saved.emptyTitle")}</h2>
          <p className="mx-auto mt-1 max-w-[280px] text-[14px] text-muted">{t("saved.emptyBody")}</p>
          <Button className="mt-4" icon={Compass} onClick={() => setTab("explore")}>{t("saved.startExploring")}</Button>
        </Card>
      )}

      {[...groups.entries()].map(([key, g]) => {
        const seeds: TripSeedItem[] = g.rows.filter((r) => r.itemType !== "destination").map((r) => ({ itemType: r.itemType, itemId: r.itemId, title: r.title }));
        const label = g.dest ? `${g.dest.name}, ${prettyCountry(g.dest.country)}` : key.split(":")[1];
        return (
          <section key={key} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => g.dest && open({ type: "destination", id: g.dest.id })} className="flex min-w-0 items-center gap-1.5 text-left">
                <MapPin size={16} className="shrink-0 text-accent" />
                <h2 className="truncate text-[18px] font-bold">{label}</h2>
              </button>
              <span className="shrink-0 text-[12px] font-semibold text-muted">{t("saved.countSaved", { count: g.rows.length })}</span>
            </div>
            {g.rows.map((r) => (
              <Card key={`${r.itemType}:${r.itemId}`} className="flex items-center gap-3 p-2.5">
                <button onClick={() => open({ type: r.itemType, id: r.itemId })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    {r.gem ? <GemImage gem={r.gem} /> : r.dest ? <Scene scene={r.dest.scene} /> : g.dest ? <Scene scene={g.dest.scene} seed={3} /> : <div className="grid h-full place-items-center bg-chip"><Ticket size={18} /></div>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate text-[15px] font-bold">
                      {r.itemType === "gem" && <GemIcon size={13} className="shrink-0 text-coral" />}
                      {r.itemType === "event" && <Ticket size={13} className="shrink-0 text-[#7C5CFF]" />}
                      {r.title}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">{r.sub}</div>
                  </div>
                </button>
                {r.itemType !== "destination" && (
                  <button
                    aria-label={t("saved.addToTrip", { name: r.title })}
                    onClick={() => open({ type: "addToTrip", itemType: r.itemType, itemId: r.itemId, title: r.title, destinationId: g.dest?.id })}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chip"
                  >
                    <CalendarPlus size={16} />
                  </button>
                )}
                <SaveButton type={r.itemType} id={r.itemId} label={r.title} className="shrink-0 bg-chip shadow-none" />
              </Card>
            ))}
            {g.dest && (
              <Button variant="dark" className="w-full" icon={Route} onClick={() => open({ type: "newTrip", destinationId: g.dest!.id, items: seeds })}>
                {seeds.length ? t("saved.planWith", { place: g.dest.name, count: seeds.length }) : t("saved.plan", { place: g.dest.name })}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
