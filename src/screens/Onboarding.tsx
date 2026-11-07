import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, AtSign, Check, Loader2, Search, Sparkles, X } from "lucide-react";
import type { Profile, ProfilePatch, TravelStyle } from "../types";
import { api } from "../api";
import { useDestinations, useEvents, useGems, useUpdateProfile } from "../api/hooks";
import { Avatar, Button, Card, Chip, Field, STYLE_META, inputCls } from "../components/ui";
import { COUNTRY_NAMES, WorldMap } from "../components/WorldMap";
import { Scene } from "../components/Scene";
import { persona } from "../lib/persona";
import { suggest } from "../lib/suggest";
import { HANDLE_RE } from "../lib/rules";
import { APP_NAME, cx, prettyCountry } from "../lib/util";

const STEPS = ["About you", "Travel style", "Passport", "Radar", "Socials"];

type Draft = Required<Pick<Profile, "name" | "handle" | "home" | "bio" | "hue" | "styles" | "preferences" | "visited" | "watching" | "socials" | "visibility">>;

export function Onboarding({ profile }: { profile: Profile }) {
  const save = useUpdateProfile();
  const [step, setStep] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [handleOk, setHandleOk] = useState<boolean | null>(null);
  const [p, setP] = useState<Draft>({
    name: profile.name, handle: profile.handle.startsWith("explorer_") ? "" : profile.handle, home: profile.home, bio: profile.bio,
    hue: profile.hue, styles: profile.styles, preferences: profile.preferences, visited: profile.visited, watching: profile.watching,
    socials: profile.socials, visibility: profile.visibility,
  });
  const set = (patch: Partial<Draft>) => setP((x) => ({ ...x, ...patch }));

  // Check handle availability as the person types.
  useEffect(() => {
    if (!HANDLE_RE.test(p.handle)) return setHandleOk(null);
    let alive = true;
    const t = setTimeout(() => api.handleAvailable(p.handle).then((ok) => alive && setHandleOk(ok)).catch(() => alive && setHandleOk(null)), 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [p.handle]);

  const canNext = [p.name.trim().length > 1 && handleOk === true, p.styles.length >= 2, true, true, true][step];

  const finish = (patch: ProfilePatch) => save.mutate(patch);

  if (reveal) return <Reveal p={p} saving={save.isPending} onDone={() => finish({ ...p, name: p.name.trim(), onboarded: true })} />;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <button aria-label="Back" disabled={step === 0} onClick={() => setStep(step - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm disabled:opacity-30">
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((_, i) => <div key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-line")} />)}
          </div>
          <span className="text-xs font-bold text-muted">{step + 1}/{STEPS.length}</span>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-6 pb-6">
        {step === 0 && <StepBasics p={p} set={set} handleOk={handleOk} />}
        {step === 1 && <StepStyles p={p} set={set} />}
        {step === 2 && <StepVisited p={p} set={set} />}
        {step === 3 && <StepRadar p={p} set={set} />}
        {step === 4 && <StepSocials p={p} set={set} />}
      </div>
      <div className="border-t border-line bg-card px-5 py-3">
        <Button className="w-full py-3.5" disabled={!canNext} onClick={() => (step === STEPS.length - 1 ? setReveal(true) : setStep(step + 1))} icon={step === STEPS.length - 1 ? Sparkles : ArrowRight}>
          {step === STEPS.length - 1 ? "Build my profile" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

type StepProps = { p: Draft; set: (patch: Partial<Draft>) => void };

function StepTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="eyebrow mb-1.5 text-accent">{eyebrow}</div>
      <h1 className="font-display text-[30px] leading-tight font-semibold">{title}</h1>
      {sub && <p className="mt-2 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

function StepBasics({ p, set, handleOk }: StepProps & { handleOk: boolean | null }) {
  return (
    <>
      <StepTitle eyebrow="Step 1 · About you" title="Who's exploring?" sub="This is how other explorers will see you." />
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
          <input className={inputCls} value={p.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Sophia Thorne" autoFocus />
        </Field>
        <Field label="Handle" hint={p.handle && !HANDLE_RE.test(p.handle) ? "3–30 characters: lowercase letters, numbers, dots or underscores." : handleOk === false ? "That handle is taken." : undefined}>
          <div className="relative">
            <AtSign size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
            <input className={cx(inputCls, "pr-10 pl-10")} value={p.handle} maxLength={30} onChange={(e) => set({ handle: e.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase() })} placeholder="sophiatravels" />
            <span className="absolute top-1/2 right-4 -translate-y-1/2">
              {handleOk === true ? <Check size={17} className="text-green" /> : handleOk === false ? <X size={17} className="text-accent" /> : p.handle && HANDLE_RE.test(p.handle) ? <Loader2 size={16} className="animate-spin text-faint" /> : null}
            </span>
          </div>
        </Field>
        <Field label="Home base">
          <input className={inputCls} value={p.home} maxLength={80} onChange={(e) => set({ home: e.target.value })} placeholder="Lisbon, Portugal" />
        </Field>
        <Field label="Bio" hint="Optional">
          <textarea className={cx(inputCls, "min-h-[88px] resize-none")} maxLength={300} value={p.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Specialty coffee hunter & architectural photographer…" />
        </Field>
      </div>
    </>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-chip p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={cx("flex-1 rounded-xl py-2 text-[13px] font-bold transition", value === o.v ? "bg-card shadow-sm" : "text-muted")}>
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
      <StepTitle eyebrow="Step 2 · Travel DNA" title="How do you like to travel?" sub="Pick at least two. Your suggestions are based on these." />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STYLE_META) as TravelStyle[]).map((s) => (
          <Chip key={s} active={p.styles.includes(s)} onClick={() => toggle(s)} icon={STYLE_META[s].icon}>{STYLE_META[s].label}</Chip>
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

export function CountryPicker({ visited, onChange }: { visited: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => COUNTRY_NAMES.filter((c) => !visited.includes(c) && prettyCountry(c).toLowerCase().includes(q.toLowerCase())).slice(0, q ? 30 : 18), [q, visited]);
  return (
    <>
      <label className="relative mb-3 block">
        <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input className={cx(inputCls, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" aria-label="Search countries" />
      </label>
      {visited.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {visited.map((c) => <Chip key={c} active onClick={() => onChange(visited.filter((x) => x !== c))} icon={Check}>{prettyCountry(c)}</Chip>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {results.map((c) => <Chip key={c} onClick={() => { onChange([...visited, c]); setQ(""); }}>{prettyCountry(c)}</Chip>)}
      </div>
    </>
  );
}

function StepVisited({ p, set }: StepProps) {
  return (
    <>
      <StepTitle eyebrow="Step 3 · Passport" title="Where have you been?" sub="Each country stamps your passport for +15 explorer points." />
      <Card className="mb-4 overflow-hidden">
        <WorldMap visited={p.visited} interactive={false} className="aspect-[1.9]" />
        <div className="px-4 py-3 text-sm font-bold">{p.visited.length} countries</div>
      </Card>
      <CountryPicker visited={p.visited} onChange={(visited) => set({ visited })} />
    </>
  );
}

function StepRadar({ p, set }: StepProps) {
  const { data: destinations = [] } = useDestinations();
  const ranked = useMemo(
    () => suggest({ profile: { styles: p.styles, visited: p.visited, watching: [] }, saves: [], destinations, gems: [], events: [] }, 40)
      .map((s) => destinations.find((d) => d.id === s.id)!)
      .filter(Boolean),
    [destinations, p.styles, p.visited],
  );
  const list = [...ranked, ...destinations.filter((d) => !ranked.includes(d))].slice(0, 16);
  const toggle = (id: string) => set({ watching: p.watching.includes(id) ? p.watching.filter((x) => x !== id) : [...p.watching, id] });
  return (
    <>
      <StepTitle eyebrow="Step 4 · Radar" title="Which places are on your radar?" sub="Optional. You'll get happenings and suggestions for these." />
      <div className="grid grid-cols-2 gap-3">
        {list.map((d) => {
          const on = p.watching.includes(d.id);
          return (
            <button key={d.id} onClick={() => toggle(d.id)} aria-pressed={on} className={cx("relative overflow-hidden rounded-2xl bg-card text-left shadow-sm transition", on && "ring-2 ring-accent")}>
              <div className="h-20"><Scene scene={d.scene} seed={d.name.length} /></div>
              <div className="p-2.5">
                <div className="truncate text-[13px] font-bold">{d.name}</div>
                <div className="truncate text-[11px] text-muted">{prettyCountry(d.country)}</div>
              </div>
              {on && <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-white"><Check size={14} /></span>}
            </button>
          );
        })}
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
      <StepTitle eyebrow="Step 5 · Socials & privacy" title="Share your socials" sub="Optional. Shown on your public profile." />
      <div className="space-y-4">
        {fields.map((f) => (
          <Field key={f.k} label={f.l}>
            <div className="relative">
              <AtSign size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
              <input className={cx(inputCls, "pl-10")} maxLength={40} value={p.socials[f.k] ?? ""} placeholder={f.ph} onChange={(e) => set({ socials: { ...p.socials, [f.k]: e.target.value.replace(/^@/, "").replace(/[^a-z0-9_.-]/gi, "") || undefined } })} />
            </div>
          </Field>
        ))}
        <Field group label="Profile visibility" hint={p.visibility === "private" ? "Only you can see your profile. Your gems are shown without your name." : "Anyone can see your profile and follow you."}>
          <Segmented value={p.visibility} onChange={(visibility) => set({ visibility })} options={[{ v: "public", l: "Public" }, { v: "private", l: "Private" }]} />
        </Field>
      </div>
    </>
  );
}

function Reveal({ p, saving, onDone }: { p: Draft; saving: boolean; onDone: () => void }) {
  const per = persona(p);
  const { data: destinations = [] } = useDestinations();
  const { data: gems = [] } = useGems();
  const { data: events = [] } = useEvents();
  const picks = suggest({ profile: p, saves: [], destinations, gems, events }, 20).filter((s) => s.itemType === "gem").slice(0, 3);
  return (
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto">
      <div className="bg-navy px-6 pt-10 pb-16 text-center text-white">
        <Avatar name={p.name} hue={p.hue} size={88} ring className="mx-auto" />
        <div className="eyebrow mt-5 text-coral">Your travel persona</div>
        <h1 className="font-display mt-1 text-[32px] leading-tight font-semibold">{per.title}</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-sm text-white/75">{per.blurb}</p>
      </div>
      <div className="relative z-10 -mt-8 flex-1 space-y-4 rounded-t-[32px] bg-bg px-5 pt-6 pb-6">
        {picks.length > 0 && (
          <div>
            <div className="eyebrow mb-2 text-accent">Hidden gems picked for you</div>
            <div className="space-y-2">
              {picks.map((s) => {
                const g = gems.find((x) => x.id === s.id)!;
                const d = destinations.find((x) => x.id === g.destinationId);
                return (
                  <Card key={g.id} className="flex items-center gap-3 p-2.5">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">{d && <Scene scene={d.scene} />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{g.name}</div>
                      <div className="truncate text-xs text-green">{s.reasons[0]}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        <Button className="w-full py-4" onClick={onDone} disabled={saving} icon={ArrowRight}>{saving ? "Saving…" : `Enter ${APP_NAME}`}</Button>
      </div>
    </div>
  );
}
