import {
  ArrowUpRight, AtSign, Award, Eye, Gem, Globe, Heart, Lightbulb, LogOut, MapPin, Pencil, Route, Share2, Shield, Stamp, Users, UsersRound, Check,
} from "lucide-react";
import { useApp } from "../store/useApp";
import { BADGES, levelFor, tierFor } from "../lib/progress";
import { persona } from "../lib/persona";
import { DESTINATIONS, destinationById } from "../data/destinations";
import { TRAVELERS } from "../data/community";
import { Avatar, Button, Card, STYLE_META, Toggle } from "../components/ui";
import { WorldMap } from "../components/WorldMap";
import { APP_NAME, APP_SLOGAN, addDays, cx, fmtShort, prettyCountry, shareText } from "../lib/util";
import type { SocialLinks, Visibility } from "../types";
import { useState } from "react";

const BADGE_ICONS = { lightbulb: Lightbulb, gem: Gem, users: Users, globe: Globe, route: Route, heart: Heart };

const SOCIAL_META: Record<keyof SocialLinks, { label: string; url: (h: string) => string }> = {
  instagram: { label: "Instagram", url: (h) => `https://instagram.com/${h}` },
  x: { label: "X / Twitter", url: (h) => `https://x.com/${h}` },
  tiktok: { label: "TikTok", url: (h) => `https://tiktok.com/@${h}` },
  strava: { label: "Strava", url: (h) => `https://www.strava.com/athletes/${h}` },
};

export function Passport() {
  const s = useApp();
  const p = s.profile!;
  const lvl = levelFor(s.xp);
  const per = persona(p);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const followers = TRAVELERS.filter((t) => s.following.includes(t.id) && t.styles.filter((x) => p.styles.includes(x)).length >= 2).length + s.connections.length;
  const badgeInput = {
    tips: s.notes.length,
    gemsShared: s.sharedGems.length,
    groupsJoined: s.joinedGroups.length,
    countries: p.visited.length,
    tripsPlanned: s.trips.length,
    following: s.following.length,
  };
  const nextTrip = [...s.trips].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const nextDest = nextTrip && destinationById(nextTrip.destinationId);

  const shareProfile = async () => {
    const text = `Follow my travels on ${APP_NAME}: @${p.handle} — ${per.title}, ${p.visited.length} countries stamped. ${APP_SLOGAN}.`;
    if (await shareText(p.name, text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Identity */}
      <section className="relative pt-2 text-center">
        <Globe className="absolute top-6 right-0 text-line" size={150} strokeWidth={1} aria-hidden />
        <div className="relative mx-auto w-fit">
          <div className="rounded-full p-1 shadow-[0_0_0_3px_#F26B4F,0_0_30px_rgba(242,107,79,0.4)]">
            <Avatar name={p.name} hue={p.hue} size={104} />
          </div>
          <span className="absolute right-2 bottom-2 h-5 w-5 rounded-full bg-green ring-[3px] ring-bg" />
        </div>
        <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold tracking-wider text-accent uppercase">
          <Award size={13} /> Level {lvl.level} {lvl.tier}
        </span>
        <h1 className="font-display relative mt-2 text-[30px] font-semibold">{p.name}</h1>
        <div className="text-[14px] text-muted">@{p.handle}</div>
        {p.home && <div className="mt-2 flex items-center justify-center gap-1 text-[13px] text-muted"><MapPin size={14} className="text-accent" /> {p.home}</div>}
        {p.bio && <p className="relative mx-auto mt-3 max-w-[320px] text-[14px] text-ink/80">{p.bio}</p>}
        <div className="relative mt-4 flex justify-center gap-2">
          <Button icon={Pencil} onClick={() => s.open({ type: "editProfile" })}>Edit Dossier</Button>
          <button aria-label="Share profile" onClick={shareProfile} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card">
            {copied ? <Check size={17} className="text-green" /> : <Share2 size={17} />}
          </button>
        </div>
      </section>

      {/* Stats */}
      <Card className="grid grid-cols-4 divide-x divide-line py-4 text-center">
        {[
          { n: p.visited.length, l: "Countries" },
          { n: s.savedGems.length + s.sharedGems.length, l: "Gems logged", accent: true },
          { n: followers, l: "Followers" },
          { n: s.following.length, l: "Following" },
        ].map((x) => (
          <div key={x.l}>
            <div className={cx("font-display text-[26px] font-semibold", x.accent && "text-accent")}>{x.n}</div>
            <div className="eyebrow mt-0.5 text-[9.5px] text-muted">{x.l}</div>
          </div>
        ))}
      </Card>

      {/* Tier */}
      <section className="rounded-[28px] bg-navy p-5 text-white">
        <button onClick={() => s.open({ type: "xpLog" })} className="w-full text-left">
          <div className="flex items-center justify-between">
            <span className="eyebrow flex items-center gap-2"><Award size={16} className="text-coral" /> {lvl.tier} tier</span>
            {lvl.nextTier && <span className="rounded-full bg-[#1E4D3A] px-2.5 py-1 text-[11px] font-bold text-[#9EE6BF]">{lvl.pct}% to Lvl {lvl.level + 1}</span>}
          </div>
          <div className="mt-4 flex items-center justify-between text-[13px] font-bold">
            <span>{s.xp.toLocaleString()} / {lvl.next.toLocaleString()} XP</span>
            {lvl.nextTier && <span className="text-[#9EE6BF]">{lvl.nextTier} next</span>}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-coral to-[#FFB59E] transition-all" style={{ width: `${lvl.pct}%` }} />
          </div>
        </button>
        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          {BADGES.map((b) => {
            const [cur, goal] = b.progress(badgeInput);
            const done = cur >= goal;
            const Icon = BADGE_ICONS[b.icon];
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", done ? "bg-coral" : "bg-white/10")}><Icon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{b.title}</div>
                  <div className="truncate text-[11.5px] text-white/60">{Math.min(cur, goal)}/{goal} {b.desc}</div>
                </div>
                <span className={cx("rounded-full px-2.5 py-1 text-[10.5px] font-bold", done ? "bg-[#1E4D3A] text-[#9EE6BF]" : "bg-white/10 text-white/70")}>
                  {done ? "Complete" : `${Math.round((cur / goal) * 100)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stamps */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><Stamp size={19} className="text-accent" /> Passport Stamps</h2>
          <button onClick={() => s.open({ type: "editProfile" })} className="text-[13px] font-bold text-accent">Edit ({p.visited.length})</button>
        </div>
        <p className="mt-1 text-[13px] text-muted">Every country you've explored, stamped on your profile.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {p.visited.slice(0, 6).map((c, i) => {
            const hue = (c.length * 47) % 360;
            const dest = DESTINATIONS.find((d) => d.country === c);
            return (
              <div key={c} className="flex items-center gap-2.5 rounded-2xl bg-chip p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: `hsl(${hue} 55% 45%)` }}>
                  {c.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold">{prettyCountry(c)}</div>
                  <div className="truncate text-[11px] font-bold text-accent uppercase">{dest ? dest.name : ["Wanderer", "Explorer", "Trekker", "Seeker"][i % 4]}</div>
                </div>
              </div>
            );
          })}
          {p.visited.length === 0 && <div className="col-span-2 rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">No stamps yet — add countries you've visited.</div>}
        </div>
      </Card>

      {/* Map */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><Globe size={19} className="text-accent" /> Cartographic Odyssey</h2>
          <span className="rounded-full bg-chip px-2.5 py-1 text-[11px] font-bold">Live Sync</span>
        </div>
        <p className="mt-1 text-[13px]">
          Pinned: <b>{p.visited.length} countries visited</b> • <span className="font-bold text-accent">{p.watching.length} on your radar</span>
        </p>
        <button onClick={() => s.open({ type: "map" })} className="relative mt-3 block w-full overflow-hidden rounded-2xl">
          <WorldMap
            interactive={false}
            dark
            visited={p.visited}
            pins={p.watching.map((id) => destinationById(id)!).filter(Boolean).map((d) => ({ id: d.id, lat: d.lat, lng: d.lng, label: d.name, tone: "gem" as const }))}
            className="aspect-[1.7]"
          />
          {nextTrip && nextDest && (
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-navy/80 px-3 py-2 text-left text-[12.5px] font-bold text-white backdrop-blur">
              <span className="flex items-center gap-1.5"><MapPin size={14} /> Next: {nextDest.name}</span>
              <span className="rounded-md bg-white/15 px-2 py-0.5">{fmtShort(nextTrip.startDate)}–{fmtShort(addDays(nextTrip.startDate, nextTrip.days.length - 1))}</span>
            </div>
          )}
        </button>
      </Card>

      {/* DNA */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[19px] font-bold"><Route size={19} className="text-accent" /> Travel Style & DNA</h2>
        <div className="mt-3 rounded-2xl bg-accent-soft p-3">
          <div className="font-display text-[18px] font-semibold text-accent">{per.title}</div>
          <p className="text-[12.5px] text-ink/75">{per.blurb}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.styles.map((st) => {
            const M = STYLE_META[st];
            return (
              <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1.5 text-[12.5px] font-semibold">
                <M.icon size={13} className="text-accent" /> {M.label}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[12.5px] font-semibold text-green capitalize">
            {p.preferences.pace} pace · {p.preferences.budget} · {p.preferences.company}
          </span>
        </div>
      </Card>

      {/* Socials */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><AtSign size={19} className="text-accent" /> Connected Portals</h2>
          <button onClick={() => s.open({ type: "editProfile" })} className="text-[13px] font-bold text-accent">Edit</button>
        </div>
        <div className="mt-3 space-y-2">
          {(Object.keys(SOCIAL_META) as (keyof SocialLinks)[]).filter((k) => p.socials[k]).map((k) => (
            <a key={k} href={SOCIAL_META[k].url(p.socials[k]!)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-chip p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-navy text-[13px] font-extrabold text-white">{SOCIAL_META[k].label[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{SOCIAL_META[k].label}</div>
                <div className="truncate text-[12px] text-muted">@{p.socials[k]}</div>
              </div>
              <ArrowUpRight size={18} />
            </a>
          ))}
          {!Object.values(p.socials).some(Boolean) && (
            <button onClick={() => s.open({ type: "editProfile" })} className="w-full rounded-2xl border border-dashed border-line p-4 text-sm font-semibold text-muted">Connect Instagram, X, TikTok or Strava (+20 XP each)</button>
          )}
        </div>
      </Card>

      {/* Following */}
      {s.following.length > 0 && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-[19px] font-bold"><UsersRound size={19} className="text-accent" /> Following</h2>
          <div className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5">
            {s.following.map((id) => TRAVELERS.find((t) => t.id === id)).filter(Boolean).map((t) => (
              <button key={t!.id} onClick={() => s.open({ type: "traveler", id: t!.id })} className="w-16 shrink-0 text-center">
                <Avatar name={t!.name} hue={t!.hue} size={52} className="mx-auto" />
                <div className="mt-1 truncate text-[11.5px] font-semibold">{t!.name.split(" ")[0]}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Privacy */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[19px] font-bold"><Shield size={19} className="text-accent" /> Expedition Protocol & Privacy</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 rounded-2xl bg-chip p-3">
            <Eye size={18} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold">Traveller visibility</div>
              <div className="text-[12px] text-muted">Who can find your profile & trips</div>
            </div>
            <select
              aria-label="Traveller visibility"
              value={s.privacy.visibility}
              onChange={(e) => s.setPrivacy({ visibility: e.target.value as Visibility })}
              className="rounded-lg bg-accent-soft px-2 py-1.5 text-[12px] font-bold text-accent outline-none"
            >
              <option value="public">Public</option>
              <option value="verified">Verified only</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-chip p-3">
            <Users size={18} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold">Companion matching</div>
              <div className="truncate text-[12px] text-muted">Appear in buddy matches for your trips</div>
            </div>
            <Toggle label="Companion matching" on={s.privacy.companionMatching} onChange={(v) => s.setPrivacy({ companionMatching: v })} />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-chip p-3">
            <MapPin size={18} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold">Live buddy beacon</div>
              <div className="truncate text-[12px] text-muted">Share your trip dates with matches</div>
            </div>
            <Toggle label="Live buddy beacon" on={s.privacy.beacon} onChange={(v) => s.setPrivacy({ beacon: v })} />
          </div>
        </div>
      </Card>

      {confirmReset ? (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <span className="font-semibold">Clear this profile from this device?</span>
          <button onClick={s.reset} className="rounded-full bg-accent px-3 py-1.5 font-bold text-white">Sign out</button>
          <button onClick={() => setConfirmReset(false)} className="rounded-full bg-chip px-3 py-1.5 font-bold">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmReset(true)} className="mx-auto flex items-center gap-2 py-2 text-[13px] font-bold text-muted hover:text-accent">
          <LogOut size={15} /> Sign out & reset
        </button>
      )}
      <p className="text-center text-[11px] text-faint">Level {lvl.level} · {tierFor(lvl.level)}</p>
    </div>
  );
}
