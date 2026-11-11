import { useState } from "react";
import {
  ArrowUpRight, AtSign, BadgeCheck, Ban, CalendarDays, CalendarPlus, ChevronUp, Flag, Gem as GemIcon, Lightbulb, MapPin,
  MapPinPlus, MessagesSquare, Navigation, Plus, Route, Trash2, UserPlus, Users, Check,
} from "lucide-react";
import {
  useBlocks, useCommunitiesOf, useDeleteGem, useDestination, useEvents, useFollowing, useGems, useMe, usePosts, useProfile,
  useProfileStats, useTipVotes, useTips, useToggleBlock, useToggleFollow, useToggleTipVote,
} from "../../api/hooks";
import { PlaceCommunity } from "./Community";
import { CommunityCover } from "../../components/CommunityCards";
import { useUi } from "../../store/ui";
import { useRequireAuth } from "../../components/auth";
import { Avatar, Button, Card, PULSE_META, Sheet, STYLE_META, Tag, GEM_CATEGORY_META } from "../../components/ui";
import { EventRow, GemCard, GemImage, SaveButton, UpvoteButton } from "../../components/Cards";
import { Scene } from "../../components/Scene";
import { levelFor } from "../../lib/progress";
import { SOCIAL_META } from "../Passport";
import { cx, fmtEventDate, prettyCountry } from "../../lib/util";
import type { SocialLinks } from "../../types";
import { useTranslation } from "react-i18next";
import { NOTE_CATS, type NoteCat } from "./Forms";

function NotFound({ onClose, what }: { onClose: () => void; what: string }) {
  const { t } = useTranslation();
  return (
    <Sheet title={what} onClose={onClose}>
      <p className="py-8 text-center text-[14px] text-muted">{t("detail.unavailable", { what: what.toLowerCase() })}</p>
    </Sheet>
  );
}

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

export function DestinationSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDestination(id);
  const { data: gems = [] } = useGems();
  const { data: events = [] } = useEvents();
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  if (!d) return <NotFound onClose={onClose} what={t("detail.destination")} />;
  const here = gems.filter((g) => g.destinationId === d.id && g.status === "published").sort((a, b) => b.upvotes - a.upvotes);
  const happening = events.filter((e) => e.destinationId === d.id);

  return (
    <Sheet full title={d.name} onClose={onClose}>
      <div className="relative -mx-5 h-56">
        <Scene scene={d.scene} seed={d.name.length} />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 to-transparent" />
        <div className="absolute right-5 bottom-4 left-5 text-white">
          <div className="flex gap-2">
            {d.hiddenGem && <Tag tone="accent">{t("cards.offRadar")}</Tag>}
            <Tag>{d.popularity < 40 ? t("detail.fewCrowds") : d.popularity < 75 ? t("detail.moderateCrowds") : t("detail.busy")}</Tag>
          </div>
          <h1 className="font-display mt-2 text-[32px] leading-tight font-semibold">{d.name}</h1>
          <div className="flex items-center gap-1 text-[13px]"><MapPin size={13} /> {d.region}, {prettyCountry(d.country)}</div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <SaveButton type="destination" id={d.id} label={d.name} variant="pill" className="flex-1" />
        <Button className="flex-1 px-3" icon={Route} onClick={() => requireAuth(t("detail.signInToPlan"), () => open({ type: "newTrip", destinationId: d.id }))}>{t("detail.planTrip")}</Button>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed">{d.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="p-3"><div className="eyebrow text-muted">{t("detail.bestTime")}</div><div className="mt-1 text-[14px] font-bold">{d.bestTime || t("detail.yearRound")}</div></Card>
        <Card className="p-3"><div className="eyebrow text-muted">{t("explore.hiddenGems")}</div><div className="mt-1 text-[14px] font-bold">{t("detail.gemsShared", { count: here.length })}</div></Card>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {d.styles.map((st) => <Tag key={st} icon={STYLE_META[st].icon}>{t(`styles.${st}`)}</Tag>)}
      </div>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-bold">{t("detail.gemsHere")}</h2>
          <button onClick={() => requireAuth(t("explore.signInToShare"), () => open({ type: "shareGem", destinationId: d.id }))} className="flex items-center gap-1 text-[13px] font-bold text-accent"><MapPinPlus size={14} /> {t("detail.addOne")}</button>
        </div>
        <div className="mt-3 space-y-3">
          {here.map((g, i) => <GemCard key={g.id} gem={g} seed={i} wide />)}
          {here.length === 0 && <p className="rounded-2xl bg-chip p-4 text-[13.5px] text-muted">{t("detail.noGemsHere")}</p>}
        </div>
      </section>

      {happening.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[19px] font-bold">{t("detail.happeningHere")}</h2>
          <div className="mt-3 space-y-2">{happening.map((e) => <EventRow key={e.id} ev={e} />)}</div>
        </section>
      )}

      <div className="mt-7"><PlaceCommunity destinationId={d.id} country={d.country} /></div>

      <FieldNotes destinationId={d.id} />
    </Sheet>
  );
}

export function GemSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: gems = [], isLoading } = useGems();
  const { data: me } = useMe();
  const g = gems.find((x) => x.id === id);
  const d = useDestination(g?.destinationId);
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  const del = useDeleteGem();
  const [confirmDel, setConfirmDel] = useState(false);
  const [photo, setPhoto] = useState(0);
  if (isLoading) return <Sheet full title={t("detail.gem")} onClose={onClose}><div className="h-60 animate-pulse rounded-3xl bg-card" /></Sheet>;
  if (!g) return <NotFound onClose={onClose} what={t("detail.gem")} />;
  const mine = me?.id === g.authorId;
  const Cat = GEM_CATEGORY_META[g.category];

  return (
    <Sheet full title={g.name} onClose={onClose}>
      <div className="relative -mx-5 h-64 bg-chip">
        {g.photos.length ? <img src={g.photos[photo]} alt={t("detail.photoOf", { name: g.name })} className="h-full w-full object-cover" /> : <GemImage gem={g} />}
        {g.photos.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {g.photos.map((_, i) => <button key={i} aria-label={t("detail.photo", { n: i + 1 })} onClick={() => setPhoto(i)} className={cx("h-2 w-2 rounded-full", i === photo ? "bg-white" : "bg-white/50")} />)}
          </div>
        )}
      </div>
      {g.status !== "published" && (
        <div className="mt-4 rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent">
          {g.status === "pending" ? t("detail.inReviewPending") : g.status === "hidden" ? t("detail.inReviewHidden") : t("detail.rejected")}
        </div>
      )}
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Tag icon={Cat.icon}>{t(`gemCat.${g.category}`)}</Tag>
          <h1 className="font-display mt-2 text-[28px] leading-tight font-semibold">{g.name}</h1>
          <button onClick={() => d && open({ type: "destination", id: d.id })} className="mt-1 flex items-center gap-1 text-[13px] text-muted">
            <MapPin size={13} className="text-accent" /> {d ? `${d.name}, ` : ""}{prettyCountry(g.country)}
          </button>
        </div>
        <UpvoteButton gem={g} />
      </div>
      <div className="mt-4 flex gap-2">
        <SaveButton type="gem" id={g.id} label={g.name} variant="pill" className="flex-1" />
        <Button className="flex-1 px-3" icon={CalendarPlus} onClick={() => requireAuth(t("detail.signInToPlan"), () => open({ type: "addToTrip", itemType: "gem", itemId: g.id, title: g.name, destinationId: g.destinationId }))}>{t("detail.addToTrip")}</Button>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-line">{g.description}</p>
      {g.tip && (
        <div className="mt-4 flex gap-2 rounded-2xl bg-accent-soft p-4">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[14px] font-semibold">{g.tip}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">{g.styles.map((st) => <Tag key={st} icon={STYLE_META[st].icon}>{t(`styles.${st}`)}</Tag>)}</div>
      {g.sourcePostId && (
        <button onClick={() => open({ type: "post", id: g.sourcePostId! })} className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm">
          <MessagesSquare size={18} className="text-accent" />
          <span className="flex-1 text-[14px] font-semibold">{t("community.fromRecommendation")}</span>
          <ArrowUpRight size={17} />
        </button>
      )}
      <a href={mapsUrl(g.lat, g.lng)} target="_blank" rel="noreferrer noopener" className="mt-5 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
        <Navigation size={18} className="text-accent" />
        <span className="flex-1 text-[14px] font-semibold">{t("detail.directions")}</span>
        <ArrowUpRight size={17} />
      </a>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
        {g.author ? (
          <button onClick={() => open({ type: "profile", id: g.author!.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Avatar name={g.author.name || g.author.handle} hue={g.author.hue} src={g.author.avatarUrl} size={40} />
            <div className="min-w-0"><div className="text-[12px] text-muted">{t("detail.foundBy")}</div><div className="truncate font-bold">@{g.author.handle}</div></div>
          </button>
        ) : (
          <div className="flex-1 text-[13px] text-muted">{t("detail.sharedByPrivate")}</div>
        )}
        <span className="text-[12px] text-muted">{t("detail.saves", { count: g.saves })}</span>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-4 text-[13px] font-bold text-muted">
        {mine ? (
          confirmDel ? (
            <span className="flex items-center gap-2">{t("detail.confirmDeleteGem")}
              <button onClick={() => del.mutate(g.id, { onSuccess: onClose })} className="rounded-full bg-accent px-3 py-1.5 text-white">{t("common.delete")}</button>
              <button onClick={() => setConfirmDel(false)} className="rounded-full bg-chip px-3 py-1.5 text-ink">{t("common.cancel")}</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 hover:text-accent"><Trash2 size={14} /> {t("detail.deleteGem")}</button>
          )
        ) : (
          <button onClick={() => requireAuth(t("detail.signInToReport"), () => open({ type: "report", targetType: "gem", targetId: g.id, label: g.name, authorId: g.authorId }))} className="flex items-center gap-1.5 hover:text-accent">
            <Flag size={14} /> {t("common.report")}
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function EventSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: events = [] } = useEvents();
  const e = events.find((x) => x.id === id);
  const d = useDestination(e?.destinationId);
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  if (!e) return <NotFound onClose={onClose} what={t("detail.event")} />;
  const M = PULSE_META[e.category];
  return (
    <Sheet title={e.title} onClose={onClose}>
      <div className="-mx-5 h-40 overflow-hidden">
        {e.imageUrl ? <img src={e.imageUrl} alt="" className="h-full w-full object-cover" /> : d ? <Scene scene={d.scene} seed={e.title.length} /> : <div className="h-full bg-chip" />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tag tone="accent" icon={M.icon}>{t(`pulse.${e.category}`)}</Tag>
        <Tag icon={CalendarDays}>{fmtEventDate(e.startsAt, e.endsAt)}</Tag>
        <Tag icon={MapPin}>{e.city}</Tag>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed">{e.summary}</p>
      {e.source === "sample" && <p className="mt-3 rounded-2xl bg-chip p-3 text-[12.5px] text-muted">{t("common.sampleListing")}</p>}
      <div className="mt-5 flex gap-2">
        <SaveButton type="event" id={e.id} label={e.title} variant="pill" className="flex-1" />
        <Button className="flex-1 px-3" icon={CalendarPlus} onClick={() => requireAuth(t("detail.signInToPlan"), () => open({ type: "addToTrip", itemType: "event", itemId: e.id, title: e.title, destinationId: e.destinationId }))}>{t("detail.addToTrip")}</Button>
      </div>
      {e.url && (
        <a href={e.url} target="_blank" rel="noreferrer noopener" className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
          <span className="flex-1 text-[14px] font-semibold">{t("detail.tickets")}</span><ArrowUpRight size={17} />
        </a>
      )}
      {d && (
        <button onClick={() => open({ type: "destination", id: d.id })} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm">
          <div className="h-10 w-10 overflow-hidden rounded-xl"><Scene scene={d.scene} /></div>
          <span className="flex-1 text-[14px] font-semibold">{t("detail.exploreDest", { place: d.name })}</span><ArrowUpRight size={17} />
        </button>
      )}
    </Sheet>
  );
}

export function ProfileSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: p, isLoading } = useProfile(id);
  const { data: me } = useMe();
  const { data: stats } = useProfileStats(id);
  const { data: following = [] } = useFollowing();
  const { data: theirCommunities = [] } = useCommunitiesOf(id);
  const { data: theirPosts = [] } = usePosts({ authorId: id, limit: 5 });
  const { data: blocks = [] } = useBlocks();
  const { data: gems = [] } = useGems();
  const follow = useToggleFollow();
  const block = useToggleBlock();
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  const [confirmBlock, setConfirmBlock] = useState(false);
  if (isLoading) return <Sheet title={t("detail.explorer")} onClose={onClose}><div className="h-40 animate-pulse rounded-3xl bg-card" /></Sheet>;
  if (!p) return <NotFound onClose={onClose} what={t("detail.profile")} />;
  const isMe = me?.id === p.id;
  const isFollowing = following.includes(p.id);
  const isBlocked = blocks.includes(p.id);
  const theirGems = gems.filter((g) => g.authorId === p.id && g.status === "published");
  const lvl = levelFor(p.xp);

  return (
    <Sheet title={t("detail.explorer")} onClose={onClose}>
      <div className="text-center">
        <Avatar name={p.name || p.handle} hue={p.hue} src={p.avatarUrl} size={84} ring className="mx-auto" />
        <h2 className="font-display mt-3 text-[26px] font-semibold">{p.name || `@${p.handle}`}</h2>
        <div className="text-[13px] text-muted">@{p.handle}{p.home ? ` · ${p.home}` : ""}</div>
        <div className="mt-2"><Tag tone="accent" icon={BadgeCheck}>{t("detail.lvl", { level: lvl.level, tier: t(`tiers.${lvl.tier}`) })}</Tag></div>
        {p.bio && <p className="mx-auto mt-3 max-w-[300px] text-[14px]">{p.bio}</p>}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          { n: p.visited.length, l: t("common.countries") },
          { n: stats?.followers ?? 0, l: t("common.followers"), go: () => open({ type: "people", userId: p.id, which: "followers" }) },
          { n: stats?.following ?? 0, l: t("common.following"), go: () => open({ type: "people", userId: p.id, which: "following" }) },
          { n: stats?.posts ?? 0, l: t("community.postsLabel") },
        ].map((x) => (
          <Card key={x.l} onClick={x.go} className="px-1 py-3 text-center"><div className="font-display text-[22px] font-semibold">{x.n}</div><div className="text-[10px] leading-tight font-bold tracking-wide break-words text-muted uppercase">{x.l}</div></Card>
        ))}
      </div>
      {!isMe && (
        <div className="mt-4 flex gap-2">
          <Button variant={isFollowing ? "soft" : "primary"} className="flex-1" icon={isFollowing ? Check : UserPlus} disabled={isBlocked}
            onClick={() => requireAuth(t("detail.signInToFollow"), () => follow.mutate({ id: p.id, on: !isFollowing }))}>
            {isFollowing ? t("common.following") : t("common.follow")}
          </Button>
        </div>
      )}
      {p.styles.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{p.styles.map((st) => <Tag key={st} icon={STYLE_META[st].icon}>{t(`styles.${st}`)}</Tag>)}</div>}
      {theirCommunities.length > 0 && (
        <section className="mt-5">
          <h3 className="flex items-center gap-1.5 text-[16px] font-bold"><Users size={16} className="text-accent" /> {t("community.theirCommunities")}</h3>
          <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
            {theirCommunities.map((c) => (
              <button key={c.id} onClick={() => open({ type: "community", id: c.id })} className="flex shrink-0 items-center gap-2 rounded-full bg-card py-1 pr-3.5 pl-1 shadow-sm">
                <span className="h-8 w-8 overflow-hidden rounded-full"><CommunityCover c={c} /></span>
                <span className="text-[13px] font-bold">{c.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {theirPosts.filter((x) => x.status === "published").length > 0 && (
        <section className="mt-5">
          <h3 className="flex items-center gap-1.5 text-[16px] font-bold"><MessagesSquare size={16} className="text-accent" /> {t("community.recentPosts")}</h3>
          <div className="mt-2 space-y-2">
            {theirPosts.filter((x) => x.status === "published").map((x) => (
              <button key={x.id} onClick={() => open({ type: "post", id: x.id })} className="block w-full rounded-2xl bg-card p-3 text-left shadow-sm">
                <div className="text-[11px] font-bold tracking-wide text-accent uppercase">{t(`community.kinds.${x.kind}`)} · {x.community?.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[14px] font-bold">{x.title}</div>
              </button>
            ))}
          </div>
        </section>
      )}
      {theirGems.length > 0 && (
        <section className="mt-5">
          <h3 className="flex items-center gap-1.5 text-[16px] font-bold"><GemIcon size={16} className="text-accent" /> {t("detail.gemsTheyFound")}</h3>
          <div className="mt-2 space-y-2">
            {theirGems.slice(0, 6).map((g) => (
              <button key={g.id} onClick={() => open({ type: "gem", id: g.id })} className="flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left shadow-sm">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl"><GemImage gem={g} /></div>
                <div className="min-w-0"><div className="truncate font-bold">{g.name}</div><div className="text-[12px] text-muted">{t("detail.upvotes", { count: g.upvotes })}</div></div>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="mt-5 space-y-2">
        {(Object.keys(p.socials) as (keyof SocialLinks)[]).filter((k) => p.socials[k]).map((k) => (
          <a key={k} href={SOCIAL_META[k].url(p.socials[k]!)} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <AtSign size={17} className="text-accent" />
            <span className="flex-1 text-[14px] font-semibold">{SOCIAL_META[k].label} <span className="font-normal text-muted">@{p.socials[k]}</span></span>
            <ArrowUpRight size={17} />
          </a>
        ))}
      </div>
      {!isMe && (
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-[13px] font-bold text-muted">
          <button onClick={() => requireAuth(t("detail.signInToReport"), () => open({ type: "report", targetType: "profile", targetId: p.id, label: `@${p.handle}` }))} className="flex items-center gap-1.5 hover:text-accent"><Flag size={14} /> {t("common.report")}</button>
          {confirmBlock ? (
            <span className="flex items-center gap-2">{t("detail.confirmBlock", { handle: p.handle })}
              <button onClick={() => block.mutate({ id: p.id, on: true }, { onSuccess: () => setConfirmBlock(false) })} className="rounded-full bg-accent px-3 py-1 text-white">{t("common.block")}</button>
              <button onClick={() => setConfirmBlock(false)} className="rounded-full bg-chip px-3 py-1 text-ink">{t("common.cancel")}</button>
            </span>
          ) : isBlocked ? (
            <button onClick={() => block.mutate({ id: p.id, on: false })} className="flex items-center gap-1.5 hover:text-accent"><Ban size={14} /> {t("common.unblock")}</button>
          ) : (
            <button onClick={() => requireAuth(t("detail.signInToBlock"), () => setConfirmBlock(true))} className="flex items-center gap-1.5 hover:text-accent"><Ban size={14} /> {t("common.block")}</button>
          )}
        </div>
      )}
      {isBlocked && <p className="mt-3 text-center text-[12.5px] text-muted">{t("detail.youBlocked")}</p>}
    </Sheet>
  );
}

export function FieldNotes({ destinationId }: { destinationId: string }) {
  const { data: tips = [] } = useTips(destinationId);
  const { data: votes = [] } = useTipVotes();
  const { data: me } = useMe();
  const vote = useToggleTipVote(destinationId);
  const open = useUi((s) => s.open);
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  return (
    <section className="mt-7">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[19px] font-bold">{t("detail.fieldNotes")}</h2>
          <p className="text-[12.5px] text-muted">{t("detail.fieldNotesSub")}</p>
        </div>
        <button onClick={() => requireAuth(t("detail.signInToNote"), () => open({ type: "addTip", destinationId }))} className="flex items-center gap-1 pb-1 text-[13px] font-bold text-accent"><Plus size={14} /> {t("detail.addNote")}</button>
      </div>
      <div className="mt-3 space-y-3">
        {tips.map((tip) => {
          const v = votes.includes(tip.id);
          const mine = tip.authorId === me?.id;
          return (
            <Card key={tip.id} className="flex gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="eyebrow text-accent">{(NOTE_CATS as readonly string[]).includes(tip.category) ? t(`forms.noteCats.${tip.category as NoteCat}`) : tip.category} <span className="text-muted normal-case">• {mine ? t("common.you") : tip.author ? `@${tip.author.handle}` : t("common.anExplorer")}</span></div>
                <p className="mt-1.5 text-[13.5px]">{tip.body}</p>
                {tip.status !== "published" && <p className="mt-1 text-[12px] font-semibold text-accent">{t("detail.inReview")}</p>}
                {!mine && (
                  <button onClick={() => requireAuth(t("detail.signInToReport"), () => open({ type: "report", targetType: "tip", targetId: tip.id, label: t("detail.thisNote") }))} className="mt-2 flex items-center gap-1 text-[11.5px] font-semibold text-faint hover:text-accent">
                    <Flag size={11} /> {t("common.report")}
                  </button>
                )}
              </div>
              <button disabled={mine} onClick={() => requireAuth(t("detail.signInToVote"), () => vote.mutate({ id: tip.id, on: !v }))} aria-pressed={v} aria-label={t("detail.helpful")}
                className={cx("flex h-fit flex-col items-center rounded-xl border px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50", v ? "border-accent bg-accent-soft text-accent" : "border-line")}>
                <ChevronUp size={15} /> {tip.votes}
              </button>
            </Card>
          );
        })}
        {tips.length === 0 && <p className="rounded-2xl bg-chip p-4 text-[13.5px] text-muted">{t("detail.noNotes")}</p>}
      </div>
    </section>
  );
}
