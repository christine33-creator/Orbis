import { Bookmark, BookmarkCheck, CalendarDays, ChevronRight, Lightbulb, MapPin, ThumbsUp } from "lucide-react";
import type { Destination, Gem, ItemType, PulseEvent, Scene as SceneT } from "../types";
import { useDestination, useIsSaved, useToggleSave, useToggleUpvote, useUpvotes } from "../api/hooks";
import { useUi } from "../store/ui";
import { useRequireAuth } from "./auth";
import { Scene } from "./Scene";
import { Avatar, Card, GEM_CATEGORY_META, PULSE_META, Tag } from "./ui";
import { compact, cx, fmtEventDate, prettyCountry } from "../lib/util";
import { useTranslation } from "react-i18next";
import type { Reason } from "../lib/suggest";
import { reasonText } from "../i18n/reason";

/** Scene used when a gem has no photo: its destination's palette in its category's landscape. */
export function gemScene(gem: Gem, dest?: Destination): SceneT {
  return { kind: GEM_CATEGORY_META[gem.category].scene, palette: dest?.scene.palette ?? ["#F5C38B", "#FBEAD3", "#5E8C5A", "#24402A"] };
}

export function GemImage({ gem, className, seed = 0 }: { gem: Gem; className?: string; seed?: number }) {
  const dest = useDestination(gem.destinationId);
  if (gem.photos[0]) return <img src={gem.photos[0]} alt="" loading="lazy" className={cx("h-full w-full object-cover", className)} />;
  return <Scene scene={gemScene(gem, dest)} seed={seed} className={className} />;
}

export function SaveButton({ type, id, label, className, variant = "round" }: { type: ItemType; id: string; label: string; className?: string; variant?: "round" | "pill" }) {
  const isSaved = useIsSaved()(type, id);
  const toggle = useToggleSave();
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth(t("cards.signInToSave"), () => toggle.mutate({ type, id, on: !isSaved }));
  };
  const Icon = isSaved ? BookmarkCheck : Bookmark;
  if (variant === "pill")
    return (
      <button onClick={onClick} aria-pressed={isSaved} className={cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition", isSaved ? "bg-accent-soft text-accent" : "border border-line bg-card", className)}>
        <Icon size={16} className={isSaved ? "fill-accent" : ""} /> {isSaved ? t("common.saved") : t("common.save")}
      </button>
    );
  return (
    <button onClick={onClick} aria-pressed={isSaved} aria-label={isSaved ? t("cards.unsave", { name: label }) : t("cards.save", { name: label })} className={cx("grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-sm", className)}>
      <Icon size={17} className={isSaved ? "fill-accent text-accent" : "text-ink"} />
    </button>
  );
}

export function UpvoteButton({ gem }: { gem: Gem }) {
  const { data: upvotes } = useUpvotes();
  const toggle = useToggleUpvote();
  const requireAuth = useRequireAuth();
  const on = !!upvotes?.includes(gem.id);
  const { t } = useTranslation();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        requireAuth(t("cards.signInToUpvote"), () => toggle.mutate({ id: gem.id, on: !on }));
      }}
      aria-pressed={on}
      aria-label={on ? t("cards.removeUpvote") : t("cards.upvote")}
      className={cx("flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-bold", on && "bg-accent-soft text-accent")}
    >
      <ThumbsUp size={15} className={cx("text-accent", on && "fill-accent")} /> {compact(gem.upvotes)}
    </button>
  );
}

export function GemCard({ gem, seed = 0, wide, reasons }: { gem: Gem; seed?: number; wide?: boolean; reasons?: Reason[] }) {
  const open = useUi((s) => s.open);
  const dest = useDestination(gem.destinationId);
  const { t } = useTranslation();
  const Cat = GEM_CATEGORY_META[gem.category];
  return (
    <Card className={cx("relative shrink-0 snap-start overflow-hidden", wide ? "w-full" : "w-[78%] max-w-[300px]")}>
      <button onClick={() => open({ type: "gem", id: gem.id })} className="relative block h-40 w-full" aria-label={t("cards.open", { name: gem.name })}>
        <GemImage gem={gem} seed={seed} />
        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-navy/70 px-2.5 py-1 text-[10.5px] font-bold tracking-wider text-white uppercase backdrop-blur">
          <Cat.icon size={12} /> {t(`gemCat.${gem.category}`)}
        </span>
      </button>
      <SaveButton type="gem" id={gem.id} label={gem.name} className="absolute top-3 right-3" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => open({ type: "gem", id: gem.id })} className="min-w-0 text-left">
            <h3 className="truncate text-[17px] font-bold">{gem.name}</h3>
          </button>
          <UpvoteButton gem={gem} />
        </div>
        <p className="flex items-center gap-1 text-[12.5px] text-muted">
          <MapPin size={12} className="text-accent" /> {dest ? `${dest.name}, ` : ""}{prettyCountry(gem.country)}
        </p>
        {reasons?.length ? (
          <p className="mt-2 text-[12px] font-semibold text-green">{reasonText(t, reasons[0])}</p>
        ) : gem.tip ? (
          <div className="mt-3 flex gap-2 rounded-2xl bg-chip p-3">
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
            <p className="line-clamp-2 text-[12.5px] font-medium">{gem.tip}</p>
          </div>
        ) : null}
        {gem.author && (
          <button onClick={() => open({ type: "profile", id: gem.author!.id })} className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <Avatar name={gem.author.name || gem.author.handle} hue={gem.author.hue} src={gem.author.avatarUrl} size={20} /> {t("cards.foundBy")} <b className="text-ink">@{gem.author.handle}</b>
          </button>
        )}
      </div>
    </Card>
  );
}

export function EventRow({ ev, reason }: { ev: PulseEvent; reason?: string }) {
  const open = useUi((s) => s.open);
  const dest = useDestination(ev.destinationId);
  const M = PULSE_META[ev.category];
  const { t } = useTranslation();
  return (
    <Card className="flex items-center gap-3 p-3 pr-3">
      <button onClick={() => open({ type: "event", id: ev.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={t("cards.open", { name: ev.title })}>
      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-2xl">
        {ev.imageUrl ? <img src={ev.imageUrl} alt="" className="h-full w-full object-cover" /> : dest ? <Scene scene={dest.scene} seed={ev.title.length} /> : <div className="h-full w-full bg-chip" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="eyebrow flex items-center gap-1 text-accent">
          <M.icon size={11} /> {ev.city} • {t(`pulse.${ev.category}`)}
        </div>
        <div className="mt-0.5 truncate text-[15px] font-bold">{ev.title}</div>
        <div className="flex items-center gap-1 truncate text-[12.5px] text-muted">
          <CalendarDays size={12} /> {fmtEventDate(ev.startsAt, ev.endsAt)}
          {reason && <span className="truncate text-green">· {reason}</span>}
        </div>
      </div>
      </button>
      <SaveButton type="event" id={ev.id} label={ev.title} className="shrink-0 bg-chip shadow-none" />
    </Card>
  );
}

export function DestinationCard({ d, reasons, seed = 0 }: { d: Destination; reasons?: Reason[]; seed?: number }) {
  const open = useUi((s) => s.open);
  const { t } = useTranslation();
  return (
    <Card className="relative w-[62%] max-w-[240px] shrink-0 snap-start overflow-hidden">
      <button onClick={() => open({ type: "destination", id: d.id })} className="block w-full text-left">
        <div className="h-28"><Scene scene={d.scene} seed={seed} /></div>
        <div className="p-3">
          <div className="truncate text-[15px] font-bold">{d.name}</div>
          <div className="truncate text-[12px] text-muted">{prettyCountry(d.country)}</div>
          {reasons?.[0] && <div className="mt-1 line-clamp-2 text-[11.5px] font-semibold text-green">{reasonText(t, reasons[0])}</div>}
        </div>
      </button>
      {d.hiddenGem && <span className="absolute top-2 left-2"><Tag tone="accent">{t("cards.offRadar")}</Tag></span>}
      <SaveButton type="destination" id={d.id} label={d.name} className="absolute top-2 right-2" />
    </Card>
  );
}

export function ListRow({ title, sub, onClick, right }: { title: string; sub?: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-3" onClick={onClick}>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{title}</div>
        {sub && <div className="truncate text-[12.5px] text-muted">{sub}</div>}
      </div>
      {right ?? <ChevronRight size={17} className="text-muted" />}
    </Card>
  );
}
