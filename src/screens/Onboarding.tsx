import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, AtSign, Check, Gem, Globe, Search, Sparkles, Users } from "lucide-react";
import type { Profile, TravelStyle, TripStyle } from "../types";
import { demoSeed, useApp } from "../store/useApp";
import { Logo } from "../components/Chrome";
import { Avatar, Button, Card, Chip, Field, STYLE_META, TRIP_STYLE_META, inputCls } from "../components/ui";
import { COUNTRY_NAMES, WorldMap } from "../components/WorldMap";
import { DESTINATIONS } from "../data/destinations";
import { Scene } from "../components/Scene";
import { persona, recommend } from "../lib/persona";
import { XP, tierFor } from "../lib/progress";
import { APP_NAME, APP_SLOGAN, addDays, cx, prettyCountry, todayIso } from "../lib/util";

const STEPS = ["About you", "Travel style", "Passport", "Radar", "Next trip", "Socials"];

export function Onboarding() {
  const complete = useApp((s) => s.completeOnboarding);
  const [step, setStep] = useState(-1);
  const [p, setP] = useState<Profile>({
    name: "",
    handle: "",
    home: "",
    bio: "",
    hue: Math.floor(Math.random() * 360),
    styles: [],
    preferences: { pace: "balanced", budget: "comfort", company: "solo" },
    visited: [],
    watching: [],
    socials: {},
  });
  const [trip, setTrip] = useState<{ destinationId: string; style: TripStyle; start: string; days: number } | null>(null);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  const canNext = [
    p.name.trim().length > 1 && p.handle.trim().length > 1,
    p.styles.length >= 2,
    true,
    p.watching.length >= 1,
    true,
    true,
  ][step];

  if (step === -1) {
    return (
      <div className="no-scrollbar flex h-full flex-col overflow-y-auto">
        <div className="relative h-[52%] min-h-[300px] shrink-0 overflow-hidden bg-navy">
          <WorldMap interactive={false} dark pins={DESTINATIONS.map((d) => ({ id: d.id, lat: d.lat, lng: d.lng, label: d.name, tone: d.hiddenGem ? "gem" : "popular" }))} className="absolute inset-0 top-16 scale-[1.35]" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/30 via-transparent to-navy" />
          <div className="absolute top-6 left-6 flex items-center gap-2 text-white">
            <div className="rounded-full bg-white p-1"><Logo size={26} /></div>
            <span className="font-display text-2xl font-semibold">{APP_NAME}</span>
          </div>
        </div>
        <div className="relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[32px] bg-bg px-6 pt-8 pb-8">
          <h1 className="font-display text-[36px] leading-[1.08] font-semibold">{APP_SLOGAN}.</h1>
          <p className="mt-3 text-[15px] text-muted">The world, curated by the people exploring it. Find hidden gems, plan trips around your style, and meet travellers heading where you are.</p>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[12px] font-semibold">
            {[
              { icon: Gem, t: "Hidden gems" },
              { icon: Users, t: "Travel buddies" },
              { icon: Sparkles, t: "Earn XP" },
            ].map(({ icon: I, t }) => (
              <div key={t} className="rounded-2xl bg-card py-3 shadow-sm">
                <I className="mx-auto mb-1 text-accent" size={20} />
                {t}
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <Button className="mt-8 w-full py-4" onClick={() => setStep(0)} icon={ArrowRight}>
            Create my traveller profile
          </Button>
          <button
            className="mt-3 py-2 text-sm font-bold text-muted hover:text-ink"
            onClick={() => {
              const d = demoSeed(todayIso());
              complete(d.profile, d.firstTrip);
            }}
          >
            Look around with a demo profile
          </button>
        </div>
      </div>
    );
  }

  if (step === STEPS.length) return <Reveal p={p} onDone={() => complete(p, trip ?? undefined)} />;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <button aria-label="Back" onClick={() => setStep(step - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-line")} />
            ))}
          </div>
          <span className="text-xs font-bold text-muted">{step + 1}/{STEPS.length}</span>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-6 pb-6">
        {step === 0 && <StepBasics p={p} set={set} />}
        {step === 1 && <StepStyles p={p} set={set} />}
        {step === 2 && <StepVisited p={p} set={set} />}
        {step === 3 && <StepRadar p={p} set={set} />}
        {step === 4 && <StepTrip p={p} trip={trip} setTrip={setTrip} />}
        {step === 5 && <StepSocials p={p} set={set} />}
      </div>
      <div className="border-t border-line bg-card px-5 py-3">
        <Button className="w-full py-3.5" disabled={!canNext} onClick={() => setStep(step + 1)} icon={step === STEPS.length - 1 ? Sparkles : ArrowRight}>
          {step === STEPS.length - 1 ? "Build my profile" : step === 4 && !trip ? "Skip for now" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

type StepProps = { p: Profile; set: (patch: Partial<Profile>) => void };

function StepTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="eyebrow mb-1.5 text-accent">{eyebrow}</div>
      <h1 className="font-display text-[30px] leading-tight font-semibold">{title}</h1>
      {sub && <p className="mt-2 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

function StepBasics({ p, set }: StepProps) {
  return (
    <>
      <StepTitle eyebrow="Step 1 · About you" title="Who's exploring?" sub="This is how fellow travellers will find you." />
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={p.name || "?"} hue={p.hue} size={72} ring />
        <div>
          <div className="text-sm font-semibold">Profile colour</div>
          <div className="mt-2 flex gap-2">
            {[10, 40, 150, 200, 260, 320].map((h) => (
              <button key={h} aria-label={`Colour ${h}`} onClick={() => set({ hue: h })} className={cx("h-7 w-7 rounded-full", p.hue === h && "ring-2 ring-ink ring-offset-2")} style={{ background: `hsl(${h} 60% 50%)` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Field label="Name">
          <input className={inputCls} value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Sophia Thorne" autoFocus />
        </Field>
        <Field label="Handle">
          <div className="relative">
            <AtSign size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
            <input className={cx(inputCls, "pl-10")} value={p.handle} onChange={(e) => set({ handle: e.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase() })} placeholder="sophiatravels" />
          </div>
        </Field>
        <Field label="Home base">
          <input className={inputCls} value={p.home} onChange={(e) => set({ home: e.target.value })} placeholder="Lisbon, Portugal" />
        </Field>
        <Field label="Bio" hint="Optional — what kind of traveller are you?">
          <textarea className={cx(inputCls, "min-h-[88px] resize-none")} value={p.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Specialty coffee hunter & architectural photographer…" />
        </Field>
      </div>
    </>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-chip p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cx("flex-1 rounded-xl py-2 text-[13px] font-bold transition", value === o.v ? "bg-card shadow-sm" : "text-muted")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function StepStyles({ p, set }: StepProps) {
  const toggle = (s: TravelStyle) => set({ styles: p.styles.includes(s) ? p.styles.filter((x) => x !== s) : [...p.styles, s] });
  return (
    <>
      <StepTitle eyebrow="Step 2 · Travel DNA" title="How do you like to travel?" sub="Pick at least two. We'll tune gems, itineraries and buddy matches to you." />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STYLE_META) as TravelStyle[]).map((s) => (
          <Chip key={s} active={p.styles.includes(s)} onClick={() => toggle(s)} icon={STYLE_META[s].icon}>
            {STYLE_META[s].label}
          </Chip>
        ))}
      </div>
      <div className="mt-8 space-y-5">
        <Field group label="Pace">
          <Segmented value={p.preferences.pace} onChange={(pace) => set({ preferences: { ...p.preferences, pace } })} options={[{ v: "slow", l: "Slow" }, { v: "balanced", l: "Balanced" }, { v: "packed", l: "Packed" }]} />
        </Field>
        <Field group label="Budget">
          <Segmented value={p.preferences.budget} onChange={(budget) => set({ preferences: { ...p.preferences, budget } })} options={[{ v: "shoestring", l: "Shoestring" }, { v: "comfort", l: "Comfort" }, { v: "luxury", l: "Luxury" }]} />
        </Field>
        <Field group label="Usually travel">
          <Segmented value={p.preferences.company} onChange={(company) => set({ preferences: { ...p.preferences, company } })} options={[{ v: "solo", l: "Solo" }, { v: "duo", l: "Duo" }, { v: "group", l: "Group" }, { v: "family", l: "Family" }]} />
        </Field>
      </div>
    </>
  );
}

function StepVisited({ p, set }: StepProps) {
  const [q, setQ] = useState("");
  const results = useMemo(
    () => COUNTRY_NAMES.filter((c) => prettyCountry(c).toLowerCase().includes(q.toLowerCase())).slice(0, q ? 30 : 18),
    [q],
  );
  const toggle = (c: string) => set({ visited: p.visited.includes(c) ? p.visited.filter((x) => x !== c) : [...p.visited, c] });
  return (
    <>
      <StepTitle eyebrow="Step 3 · Passport" title="Where have you been?" sub={`Each country stamps your passport for +${XP.addVisitedCountry} XP.`} />
      <Card className="mb-4 overflow-hidden">
        <WorldMap visited={p.visited} interactive={false} className="aspect-[1.9]" />
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="font-bold">{p.visited.length} countries</span>
          <span className="font-semibold text-accent">+{p.visited.length * XP.addVisitedCountry} XP</span>
        </div>
      </Card>
      <div className="relative mb-3">
        <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input className={cx(inputCls, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" />
      </div>
      {p.visited.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {p.visited.map((c) => (
            <Chip key={c} active onClick={() => toggle(c)} icon={Check}>{prettyCountry(c)}</Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {results.filter((c) => !p.visited.includes(c)).map((c) => (
          <Chip key={c} onClick={() => toggle(c)}>{prettyCountry(c)}</Chip>
        ))}
      </div>
    </>
  );
}

function StepRadar({ p, set }: StepProps) {
  const ranked = recommend(p);
  const toggle = (id: string) => set({ watching: p.watching.includes(id) ? p.watching.filter((x) => x !== id) : [...p.watching, id] });
  return (
    <>
      <StepTitle eyebrow="Step 4 · Radar" title="Which places are on your radar?" sub="You'll get news, events and local intel for these. Sorted by fit with your style." />
      <div className="grid grid-cols-2 gap-3">
        {ranked.slice(0, 14).map((d) => {
          const on = p.watching.includes(d.id);
          return (
            <button key={d.id} onClick={() => toggle(d.id)} aria-pressed={on} className={cx("relative overflow-hidden rounded-2xl bg-card text-left shadow-sm transition", on && "ring-2 ring-accent")}>
              <div className="h-20"><Scene scene={d.scene} seed={d.name.length} /></div>
              <div className="p-2.5">
                <div className="truncate text-[13px] font-bold">{d.name}</div>
                <div className="text-[11px] font-semibold text-green">{d.fit}% fit</div>
              </div>
              {d.hiddenGem && <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-bold text-accent">GEM</span>}
              {on && <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-white"><Check size={14} /></span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function StepTrip({ p, trip, setTrip }: { p: Profile; trip: { destinationId: string; style: TripStyle; start: string; days: number } | null; setTrip: (t: { destinationId: string; style: TripStyle; start: string; days: number } | null) => void }) {
  const t = trip ?? { destinationId: "", style: "culture" as TripStyle, start: addDays(todayIso(), 14), days: 5 };
  const options = DESTINATIONS.filter((d) => p.watching.includes(d.id)).concat(DESTINATIONS.filter((d) => !p.watching.includes(d.id)));
  return (
    <>
      <StepTitle eyebrow="Step 5 · Next trip" title="Planning something?" sub="We'll draft a day-by-day itinerary in your style. You can skip this." />
      <div className="space-y-5">
        <Field label="Destination">
          <select className={inputCls} value={t.destinationId} onChange={(e) => setTrip(e.target.value ? { ...t, destinationId: e.target.value } : null)}>
            <option value="">Not yet — skip</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>{d.name}, {prettyCountry(d.country)}</option>
            ))}
          </select>
        </Field>
        {trip && (
          <>
            <Field group label="Trip style">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TRIP_STYLE_META) as TripStyle[]).map((s) => {
                  const M = TRIP_STYLE_META[s];
                  return (
                    <button key={s} onClick={() => setTrip({ ...t, style: s })} className={cx("rounded-2xl border p-3 text-left transition", t.style === s ? "border-accent bg-accent-soft" : "border-line bg-card")}>
                      <M.icon size={18} className={t.style === s ? "text-accent" : ""} />
                      <div className="mt-1.5 text-[13px] font-bold">{M.label}</div>
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input type="date" className={inputCls} value={t.start} onChange={(e) => setTrip({ ...t, start: e.target.value })} />
              </Field>
              <Field label="Days">
                <input type="number" min={1} max={21} className={inputCls} value={t.days} onChange={(e) => setTrip({ ...t, days: Math.max(1, Math.min(21, Number(e.target.value) || 1)) })} />
              </Field>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StepSocials({ p, set }: StepProps) {
  const fields: { k: keyof Profile["socials"]; l: string; ph: string }[] = [
    { k: "instagram", l: "Instagram", ph: "sophia.lens" },
    { k: "x", l: "X / Twitter", ph: "sophiathorne" },
    { k: "tiktok", l: "TikTok", ph: "sophiatravels" },
    { k: "strava", l: "Strava", ph: "sophia.hikes" },
  ];
  return (
    <>
      <StepTitle eyebrow="Step 6 · Connected portals" title="Share your socials" sub={`Optional. Let fellow travellers follow your journey (+${XP.connectSocial} XP each).`} />
      <div className="space-y-4">
        {fields.map((f) => (
          <Field key={f.k} label={f.l}>
            <div className="relative">
              <AtSign size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
              <input className={cx(inputCls, "pl-10")} value={p.socials[f.k] ?? ""} placeholder={f.ph} onChange={(e) => set({ socials: { ...p.socials, [f.k]: e.target.value.replace(/^@/, "") || undefined } })} />
            </div>
          </Field>
        ))}
      </div>
    </>
  );
}

function Reveal({ p, onDone }: { p: Profile; onDone: () => void }) {
  const per = persona(p);
  const gems = recommend(p, { gemsOnly: true }).slice(0, 3);
  const startXp = XP.completeProfile + p.visited.length * XP.addVisitedCountry + Object.values(p.socials).filter(Boolean).length * XP.connectSocial;
  return (
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto">
      <div className="relative bg-navy px-6 pt-10 pb-16 text-center text-white">
        <Globe className="absolute top-6 right-6 opacity-10" size={120} />
        <Avatar name={p.name} hue={p.hue} size={88} ring className="mx-auto" />
        <div className="eyebrow mt-5 text-coral">Your travel persona</div>
        <h1 className="font-display mt-1 text-[32px] leading-tight font-semibold">{per.title}</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-sm text-white/75">{per.blurb}</p>
      </div>
      <div className="relative z-10 -mt-8 flex-1 space-y-4 rounded-t-[32px] bg-bg px-5 pt-6 pb-6">
        <Card className="flex items-center justify-between p-4">
          <div>
            <div className="eyebrow text-muted">Starting tier</div>
            <div className="font-display text-xl font-semibold">Level 1 · {tierFor(1)}</div>
          </div>
          <div className="rounded-full bg-mint px-3 py-1.5 text-sm font-bold text-green">+{startXp} XP</div>
        </Card>
        <div>
          <div className="eyebrow mb-2 text-accent">Hidden gems picked for you</div>
          <div className="space-y-2">
            {gems.map((g) => (
              <Card key={g.id} className="flex items-center gap-3 p-2.5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"><Scene scene={g.scene} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{g.name}</div>
                  <div className="truncate text-xs text-muted">{g.tagline}</div>
                </div>
                <div className="text-xs font-bold text-green">{g.fit}%</div>
              </Card>
            ))}
          </div>
        </div>
        <Button className="w-full py-4" onClick={onDone} icon={ArrowRight}>Enter {APP_NAME}</Button>
      </div>
    </div>
  );
}
