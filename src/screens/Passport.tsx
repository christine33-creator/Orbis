import { useState } from "react";
import {
  ArrowUpRight, AtSign, Award, Bookmark, Check, Gem, Globe, Heart, MapPin, Pencil, Route, Settings, Share2, Shield, Stamp,
} from "lucide-react";
import { useFollowCounts, useFollowing, useGems, useMe, useSaves, useTrips } from "../api/hooks";
import { useUi } from "../store/ui";
import { BADGES, levelFor } from "../lib/progress";
import { persona } from "../lib/persona";
import { Avatar, Button, Card, STYLE_META, Tag } from "../components/ui";
import { WorldMap } from "../components/WorldMap";
import { GemImage } from "../components/Cards";
import { SignInPrompt } from "./SignInPrompt";
import { APP_NAME, APP_SLOGAN, cx, prettyCountry, shareText } from "../lib/util";
import type { SocialLinks } from "../types";

const BADGE_ICONS = { gem: Gem, bookmark: Bookmark, globe: Globe, route: Route, heart: Heart };

export const SOCIAL_META: Record<keyof SocialLinks, { label: string; url: (h: string) => string }> = {
  instagram: { label: "Instagram", url: (h) => `https://instagram.com/${encodeURIComponent(h)}` },
  x: { label: "X / Twitter", url: (h) => `https://x.com/${encodeURIComponent(h)}` },
  tiktok: { label: "TikTok", url: (h) => `https://tiktok.com/@${encodeURIComponent(h)}` },
  strava: { label: "Strava", url: (h) => `https://www.strava.com/athletes/${encodeURIComponent(h)}` },
};

const STATUS_LABEL = { pending: "In review", hidden: "Hidden after reports", rejected: "Not approved", published: "Live" } as const;

export function Passport() {
  const user = useUi((s) => s.user);
  const { data: me } = useMe();
  const { data: gems = [] } = useGems();
  const { data: saves = [] } = useSaves();
  const { data: trips = [] } = useTrips();
  const { data: following = [] } = useFollowing();
  const { data: counts } = useFollowCounts(me?.id ?? "");
  const open = useUi((s) => s.open);
  const [copied, setCopied] = useState(false);

  if (!user) return <SignInPrompt icon={Stamp} title="Your travel passport" body="Collect stamps, earn explorer points for sharing gems, and build your travel identity." />;
  if (!me) return <div className="h-60 animate-pulse rounded-3xl bg-card" />;

  const lvl = levelFor(me.xp);
  const per = persona(me);
  const mine = gems.filter((g) => g.authorId === me.id);
  const badgeInput = { gemsShared: mine.filter((g) => g.status === "published").length, saves: saves.length, countries: me.visited.length, tripsPlanned: trips.length, following: following.length };

  const shareProfile = async () => {
    if (await shareText(me.name, `Follow my travels on ${APP_NAME}: @${me.handle} — ${per.title}. ${APP_SLOGAN}.`)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <section className="relative pt-2 text-center">
        <Globe className="absolute top-6 right-0 text-line" size={150} strokeWidth={1} aria-hidden />
        <div className="relative mx-auto w-fit rounded-full p-1 shadow-[0_0_0_3px_#F26B4F,0_0_30px_rgba(242,107,79,0.4)]">
          <Avatar name={me.name || me.handle} hue={me.hue} size={104} />
        </div>
        <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-wider text-accent uppercase">
          <Award size={13} /> Level {lvl.level} {lvl.tier}
        </span>
        <h1 className="font-display relative mt-2 text-[30px] font-semibold">{me.name}</h1>
        <div className="text-[14px] text-muted">@{me.handle}{me.visibility === "private" && " · Private profile"}</div>
        {me.home && <div className="mt-2 flex items-center justify-center gap-1 text-[13px] text-muted"><MapPin size={14} className="text-accent" /> {me.home}</div>}
        {me.bio && <p className="relative mx-auto mt-3 max-w-[320px] text-[14px] text-ink/80">{me.bio}</p>}
        <div className="relative mt-4 flex justify-center gap-2">
          <Button icon={Pencil} onClick={() => open({ type: "editProfile" })}>Edit profile</Button>
          <button aria-label="Share profile" onClick={shareProfile} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card">
            {copied ? <Check size={17} className="text-green" /> : <Share2 size={17} />}
          </button>
          <button aria-label="Settings" onClick={() => open({ type: "settings" })} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card">
            <Settings size={17} />
          </button>
        </div>
      </section>

      <Card className="grid grid-cols-4 divide-x divide-line py-4 text-center">
        {[
          { n: me.visited.length, l: "Countries" },
          { n: badgeInput.gemsShared, l: "Gems shared", accent: true },
          { n: counts?.followers ?? 0, l: "Followers" },
          { n: counts?.following ?? 0, l: "Following" },
        ].map((x) => (
          <div key={x.l}>
            <div className={cx("font-display text-[26px] font-semibold", x.accent && "text-accent")}>{x.n}</div>
            <div className="eyebrow mt-0.5 text-[9.5px] text-muted">{x.l}</div>
          </div>
        ))}
      </Card>

      {(me.role === "moderator" || me.role === "admin") && (
        <Button variant="dark" className="w-full" icon={Shield} onClick={() => open({ type: "moderation" })}>Moderation queue</Button>
      )}

      <section className="rounded-[28px] bg-navy p-5 text-white">
        <button onClick={() => open({ type: "xpLog" })} className="w-full text-left">
          <div className="flex items-center justify-between">
            <span className="eyebrow flex items-center gap-2"><Award size={16} className="text-coral" /> {lvl.tier} tier</span>
            {lvl.nextTier && <span className="rounded-full bg-[#1E4D3A] px-2.5 py-1 text-[11px] font-bold text-[#9EE6BF]">{lvl.pct}% to Lvl {lvl.level + 1}</span>}
          </div>
          <div className="mt-4 flex items-center justify-between text-[13px] font-bold">
            <span>{me.xp.toLocaleString()} / {lvl.next.toLocaleString()} XP</span>
            <span className="text-[#9EE6BF]">History →</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-coral to-[#FFB59E] transition-all" style={{ width: `${lvl.pct}%` }} />
          </div>
        </button>
        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          {BADGES.map((b) => {
            const [cur, goal] = b.progress(badgeInput);
            const doneB = cur >= goal;
            const Icon = BADGE_ICONS[b.icon];
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", doneB ? "bg-coral" : "bg-white/10")}><Icon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{b.title}</div>
                  <div className="truncate text-[11.5px] text-white/60">{Math.min(cur, goal)}/{goal} {b.desc}</div>
                </div>
                <span className={cx("rounded-full px-2.5 py-1 text-[10.5px] font-bold", doneB ? "bg-[#1E4D3A] text-[#9EE6BF]" : "bg-white/10 text-white/70")}>
                  {doneB ? "Complete" : `${Math.round((cur / goal) * 100)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><Gem size={19} className="text-accent" /> Your Gems</h2>
          <button onClick={() => open({ type: "shareGem" })} className="text-[13px] font-bold text-accent">Share one</button>
        </div>
        <div className="mt-3 space-y-2">
          {mine.map((g) => (
            <button key={g.id} onClick={() => open({ type: "gem", id: g.id })} className="flex w-full items-center gap-3 rounded-2xl bg-chip p-2.5 text-left">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl"><GemImage gem={g} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{g.name}</div>
                <div className="text-[12px] text-muted">{g.upvotes} upvotes · {g.saves} saves</div>
              </div>
              <Tag tone={g.status === "published" ? "green" : "accent"}>{STATUS_LABEL[g.status]}</Tag>
            </button>
          ))}
          {mine.length === 0 && <p className="rounded-2xl bg-chip p-3 text-[13px] text-muted">You haven't shared a gem yet. Your finds are credited to you.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><Stamp size={19} className="text-accent" /> Passport Stamps</h2>
          <button onClick={() => open({ type: "editProfile" })} className="text-[13px] font-bold text-accent">Edit ({me.visited.length})</button>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl">
          <WorldMap interactive={false} dark visited={me.visited} className="aspect-[1.9]" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {me.visited.map((c) => <span key={c} className="rounded-full bg-chip px-2.5 py-1 text-[12px] font-semibold">{prettyCountry(c)}</span>)}
          {me.visited.length === 0 && <p className="text-[13px] text-muted">Add the countries you've visited to stamp your passport.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[19px] font-bold"><Route size={19} className="text-accent" /> Travel Style</h2>
        <div className="mt-3 rounded-2xl bg-accent-soft p-3">
          <div className="font-display text-[18px] font-semibold text-accent">{per.title}</div>
          <p className="text-[12.5px] text-ink/75">{per.blurb}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {me.styles.map((st) => {
            const M = STYLE_META[st];
            return <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1.5 text-[12.5px] font-semibold"><M.icon size={13} className="text-accent" /> {M.label}</span>;
          })}
        </div>
      </Card>

      {Object.values(me.socials).some(Boolean) && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><AtSign size={19} className="text-accent" /> Social Profiles</h2>
          <div className="mt-3 space-y-2">
            {(Object.keys(SOCIAL_META) as (keyof SocialLinks)[]).filter((k) => me.socials[k]).map((k) => (
              <a key={k} href={SOCIAL_META[k].url(me.socials[k]!)} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 rounded-2xl bg-chip p-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-navy text-[13px] font-extrabold text-white">{SOCIAL_META[k].label[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold">{SOCIAL_META[k].label}</div>
                  <div className="truncate text-[12px] text-muted">@{me.socials[k]}</div>
                </div>
                <ArrowUpRight size={18} />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
