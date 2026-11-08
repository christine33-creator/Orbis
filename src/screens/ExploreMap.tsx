import { useMemo, useState } from "react";
import { Gem as GemIcon, Layers, MapPin, Ticket, Bookmark } from "lucide-react";
import MapView, { type MapPoint } from "../components/MapView";
import { useDestinations, useEvents, useGems, useSaves } from "../api/hooks";
import { useUi } from "../store/ui";
import { Card, Chip, Tag } from "../components/ui";
import { GemImage, SaveButton } from "../components/Cards";
import { Scene } from "../components/Scene";
import { fmtEventDate, prettyCountry } from "../lib/util";
import { useTranslation } from "react-i18next";

type Layer = "all" | "gems" | "events" | "saved";

/** Full-screen map: the central discovery surface. */
export default function ExploreMap() {
  const { data: destinations = [] } = useDestinations();
  const { data: gems = [] } = useGems();
  const { data: events = [] } = useEvents();
  const { data: saves = [] } = useSaves();
  const open = useUi((s) => s.open);
  const [layer, setLayer] = useState<Layer>("all");
  const [sel, setSel] = useState<string | null>(null);
  const { t } = useTranslation();

  const savedKeys = new Set(saves.map((s) => `${s.itemType}:${s.itemId}`));
  const points = useMemo(() => {
    const pts: MapPoint[] = [];
    const add = (p: MapPoint) => {
      if (layer === "saved" && !savedKeys.has(`${p.kind}:${p.id}`)) return;
      pts.push(p);
    };
    if (layer === "all" || layer === "saved") destinations.forEach((d) => add({ id: d.id, kind: "destination", lat: d.lat, lng: d.lng, label: d.name }));
    if (layer !== "events") gems.filter((g) => g.status === "published").forEach((g) => add({ id: g.id, kind: "gem", lat: g.lat, lng: g.lng, label: g.name }));
    if (layer !== "gems") events.filter((e) => e.lat != null && e.lng != null).forEach((e) => add({ id: e.id, kind: "event", lat: e.lat!, lng: e.lng!, label: e.title }));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations, gems, events, saves, layer]);

  const selPoint = points.find((p) => p.id === sel);
  return (
    <div className="relative flex-1">
      <MapView points={points} selected={sel} onSelect={setSel} className="absolute inset-0" />
      <div className="no-scrollbar absolute inset-x-0 top-2 flex gap-2 overflow-x-auto px-4">
        <Chip active={layer === "all"} onClick={() => setLayer("all")} icon={Layers}>{t("map.everything")}</Chip>
        <Chip active={layer === "gems"} onClick={() => setLayer("gems")} icon={GemIcon}>{t("map.gems")}</Chip>
        <Chip active={layer === "events"} onClick={() => setLayer("events")} icon={Ticket}>{t("map.happenings")}</Chip>
        <Chip active={layer === "saved"} onClick={() => setLayer("saved")} icon={Bookmark}>{t("map.saved")}</Chip>
      </div>
      <div className="absolute inset-x-4 bottom-32">
        {selPoint ? (
          <Preview kind={selPoint.kind} id={selPoint.id} onOpen={() => open({ type: selPoint.kind, id: selPoint.id })} />
        ) : (
          <div className="mx-auto w-fit rounded-full bg-card/95 px-4 py-2 text-[12.5px] font-semibold text-muted shadow-md">
            <span className="text-accent">●</span> {t("map.legendDest")} <span className="ml-2 text-coral">●</span> {t("map.legendGems")} <span className="ml-2 text-[#7C5CFF]">●</span> {t("map.legendEvents")}
          </div>
        )}
      </div>
    </div>
  );

  function Preview({ kind, id, onOpen }: { kind: MapPoint["kind"]; id: string; onOpen: () => void }) {
    const d = kind === "destination" ? destinations.find((x) => x.id === id) : undefined;
    const g = kind === "gem" ? gems.find((x) => x.id === id) : undefined;
    const e = kind === "event" ? events.find((x) => x.id === id) : undefined;
    const title = d?.name ?? g?.name ?? e?.title ?? "";
    const sub = d ? d.tagline : g ? `${prettyCountry(g.country)} · ${t("map.upvotes", { count: g.upvotes })}` : e ? `${e.city} · ${fmtEventDate(e.startsAt, e.endsAt)}` : "";
    return (
      <Card className="flex items-center gap-3 p-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
            {g ? <GemImage gem={g} /> : d ? <Scene scene={d.scene} /> : <div className="grid h-full w-full place-items-center bg-[#EDE8FF] text-[#7C5CFF]"><Ticket /></div>}
          </div>
          <div className="min-w-0">
            <Tag tone={kind === "gem" ? "accent" : "neutral"}>{kind === "gem" ? t("map.kindGem") : kind === "event" ? t("map.kindEvent") : t("map.kindDest")}</Tag>
            <div className="mt-1 truncate text-[16px] font-bold">{title}</div>
            <div className="flex items-center gap-1 truncate text-[12.5px] text-muted"><MapPin size={12} /> {sub}</div>
          </div>
        </button>
        <SaveButton type={kind} id={id} label={title} className="shrink-0 bg-chip shadow-none" />
      </Card>
    );
  }
}
