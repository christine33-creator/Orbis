import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Check, CirclePlus, Flag, Gem as GemIcon, ImagePlus, LocateFixed, Plus, Route, Sparkles, X } from "lucide-react";
import {
  useAddToTrip, useCreateGem, useCreateTip, useCreateTrip, useDestinations, useMe, useReport,
  useToggleBlock, useTripItemMutations, useTrips, useUpdateProfile,
} from "../../api/hooks";
import { api } from "../../api";
import { useUi, type Overlay, type TripSeedItem } from "../../store/ui";
import { Avatar, Button, Chip, Field, GEM_CATEGORY_META, Sheet, STYLE_META, TRIP_STYLE_META, inputCls } from "../../components/ui";
import { CountryPicker } from "../Onboarding";
import { preparePhoto } from "../../lib/image";
import { countryAt, nearestDestination } from "../../lib/geo";
import { HANDLE_RE, needsReview } from "../../lib/rules";
import { addDays, cx, fmtRange, prettyCountry, todayIso } from "../../lib/util";
import type { GemCategory, ItemType, Profile, ReportReason, SocialLinks, TravelStyle, TripStyle } from "../../types";

const MapView = lazy(() => import("../../components/MapView"));

/* ------------------------------------------------------------------ Share a gem */

export function ShareGemSheet({ destinationId, onClose }: { destinationId?: string; onClose: () => void }) {
  const { data: destinations = [] } = useDestinations();
  const create = useCreateGem();
  const toast = useUi((s) => s.toast);
  const open = useUi((s) => s.open);
  const startDest = destinations.find((d) => d.id === destinationId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GemCategory>("viewpoint");
  const [description, setDescription] = useState("");
  const [tip, setTip] = useState("");
  const [styles, setStyles] = useState<TravelStyle[]>([]);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const country = point ? countryAt(point.lat, point.lng) : null;
  const near = point ? nearestDestination(point, destinations) : startDest;
  const flagged = needsReview(`${name} ${description} ${tip}`);
  const valid = name.trim().length >= 2 && description.trim().length >= 10 && point && agreed;

  const addPhotos = async (files: FileList | null) => {
    setPhotoError("");
    if (!files) return;
    const room = 6 - photos.length;
    for (const f of Array.from(files).slice(0, room)) {
      try {
        const blob = await preparePhoto(f);
        setPhotos((p) => [...p, { blob, url: URL.createObjectURL(blob) }]);
      } catch (e) {
        setPhotoError((e as Error).message);
      }
    }
  };

  const submit = () => {
    if (!point) return;
    create.mutate(
      {
        gem: {
          destinationId: near?.id ?? null, name: name.trim(), description: description.trim(), tip: tip.trim(), category, styles,
          lat: point.lat, lng: point.lng, country: country ?? near?.country ?? "",
        },
        photos: photos.map((p) => p.blob),
      },
      {
        onSuccess: (gem) => {
          onClose();
          if (gem.status === "pending") toast({ text: "Sent for review", sub: "A moderator will check it before it goes public.", tone: "info" });
          open({ type: "gem", id: gem.id });
        },
      },
    );
  };

  return (
    <Sheet full title="Share a hidden gem" onClose={onClose}
      footer={<Button className="w-full" icon={GemIcon} disabled={!valid || create.isPending} onClick={submit}>{create.isPending ? "Sharing…" : "Share gem · +50 XP"}</Button>}>
      <div className="space-y-5">
        <Field label="Place name">
          <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Valbona Valley viewpoint" />
        </Field>
        <Field group label="What kind of place?">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GEM_CATEGORY_META) as GemCategory[]).map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)} icon={GEM_CATEGORY_META[c].icon}>{GEM_CATEGORY_META[c].label}</Chip>
            ))}
          </div>
        </Field>
        <Field group label="Location" hint={point ? `${country ? prettyCountry(country) : "Location set"}${near ? ` · near ${near.name}` : ""}` : "Tap the map to drop a pin, or use your current location."}>
          <Suspense fallback={<div className="h-60 animate-pulse rounded-2xl bg-card" />}>
            <MapView
              points={[]}
              pick={point}
              onPick={setPoint}
              center={startDest ? { lat: startDest.lat, lng: startDest.lng, zoom: 10 } : undefined}
              className="h-60 rounded-2xl border border-line"
            />
          </Suspense>
          {!point && (
            <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setPoint({ lat: p.coords.latitude, lng: p.coords.longitude }), () => toast({ text: "Couldn't get your location", sub: "Drop a pin on the map instead.", tone: "error" }), { timeout: 8000 })}
              className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-accent">
              <LocateFixed size={14} /> Use my current location
            </button>
          )}
        </Field>
        <Field label="Why it's special" hint={`${description.trim().length}/1000 · at least 10 characters`}>
          <textarea className={cx(inputCls, "min-h-[96px] resize-none")} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A quiet terrace above the old town where locals watch the sunset…" />
        </Field>
        <Field label="Insider tip" hint="Optional: timing, how to get there, what to order">
          <textarea className={cx(inputCls, "min-h-[72px] resize-none")} maxLength={500} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Go on a weekday before 9 AM." />
        </Field>
        <Field group label={`Photos (${photos.length}/6)`} hint={photoError || "Location data is removed from photos before upload."}>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-xl">
                <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-navy/70 text-white"><X size={13} /></button>
              </div>
            ))}
            {photos.length < 6 && (
              <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line bg-card text-muted">
                <ImagePlus size={22} />
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </Field>
        <Field group label="Good for">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STYLE_META) as TravelStyle[]).map((st) => (
              <Chip key={st} active={styles.includes(st)} onClick={() => setStyles(styles.includes(st) ? styles.filter((x) => x !== st) : [...styles, st])}>{STYLE_META[st].label}</Chip>
            ))}
          </div>
        </Field>
        {flagged && <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent">Links, phone numbers and email addresses are allowed, but they send your gem to a moderator for review first.</p>}
        <label className="flex items-start gap-3 rounded-2xl bg-card p-3 text-[13px] shadow-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#B8361C]" />
          <span>This is a real place I know, the photos are mine to share, and it follows the{" "}
            <button type="button" onClick={() => open({ type: "guidelines" })} className="font-bold text-accent underline">community guidelines</button>.
          </span>
        </label>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Trips */

function DestinationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: destinations = [] } = useDestinations();
  const { data: me } = useMe();
  const watching = me?.watching ?? [];
  const sorted = [...destinations].sort((a, b) => Number(watching.includes(b.id)) - Number(watching.includes(a.id)) || a.name.localeCompare(b.name));
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Anywhere / multiple places</option>
      {sorted.map((d) => <option key={d.id} value={d.id}>{d.name}, {prettyCountry(d.country)}</option>)}
    </select>
  );
}

export function NewTripSheet({ destinationId, items, onClose }: { destinationId?: string; items?: TripSeedItem[]; onClose: () => void }) {
  const create = useCreateTrip();
  const setTab = useUi((s) => s.setTab);
  const setActive = useUi((s) => s.setActiveTrip);
  const { data: destinations = [] } = useDestinations();
  const [dest, setDest] = useState(destinationId ?? "");
  const [style, setStyle] = useState<TripStyle>("culture");
  const [start, setStart] = useState(addDays(todayIso(), 14));
  const [days, setDays] = useState(Math.max(2, Math.min(7, items?.length ?? 3)));
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>((items ?? []).map((i) => `${i.itemType}:${i.itemId}`));
  const d = destinations.find((x) => x.id === dest);
  const chosen = (items ?? []).filter((i) => picked.includes(`${i.itemType}:${i.itemId}`));

  const submit = () =>
    create.mutate(
      {
        trip: { destinationId: dest || null, title: title.trim() || `${d?.name ?? "New"} ${TRIP_STYLE_META[style].label} Trip`, style, startDate: start || null, days },
        // Spread saved stops evenly across the days; people can rearrange them after.
        items: chosen.map((it, i) => ({ day: Math.floor((i * days) / Math.max(1, chosen.length)), position: i, time: null, title: it.title, notes: "", itemType: it.itemType, itemId: it.itemId })),
      },
      {
        onSuccess: (t) => {
          setTab("trips");
          setActive(t.id);
        },
      },
    );

  return (
    <Sheet title="Plan a trip" onClose={onClose}
      footer={<Button className="w-full" icon={Sparkles} disabled={create.isPending} onClick={submit}>{create.isPending ? "Creating…" : `Create trip${chosen.length ? ` with ${chosen.length} stops` : ""} · +60 XP`}</Button>}>
      <div className="space-y-5">
        <Field label="Destination"><DestinationSelect value={dest} onChange={setDest} /></Field>
        {items && items.length > 0 && (
          <Field group label="Saved stops to include">
            <div className="space-y-1.5">
              {items.map((it) => {
                const k = `${it.itemType}:${it.itemId}`;
                const on = picked.includes(k);
                return (
                  <button key={k} onClick={() => setPicked(on ? picked.filter((x) => x !== k) : [...picked, k])} aria-pressed={on}
                    className={cx("flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-[14px] font-semibold", on ? "border-accent bg-accent-soft" : "border-line bg-card")}>
                    <span className={cx("grid h-5 w-5 place-items-center rounded-md", on ? "bg-accent text-white" : "border border-line")}>{on && <Check size={13} />}</span>
                    {it.title}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <Field group label="Trip style">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TRIP_STYLE_META) as TripStyle[]).map((st) => {
              const M = TRIP_STYLE_META[st];
              return (
                <button key={st} onClick={() => setStyle(st)} aria-pressed={style === st} className={cx("rounded-2xl border p-3 text-left", style === st ? "border-accent bg-accent-soft" : "border-line bg-card")}>
                  <M.icon size={16} className={style === st ? "text-accent" : ""} />
                  <div className="mt-1 text-[13px] font-bold">{M.label}</div>
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" hint="Optional"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Days"><input type="number" min={1} max={30} className={inputCls} value={days} onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></Field>
        </div>
        <Field label="Trip name" hint="Optional"><input className={inputCls} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${d?.name ?? "Autumn"} Odyssey`} /></Field>
      </div>
    </Sheet>
  );
}

export function AddToTripSheet({ o, onClose }: { o: Extract<Overlay, { type: "addToTrip" }>; onClose: () => void }) {
  const { data: trips = [], isLoading } = useTrips();
  const { data: destinations = [] } = useDestinations();
  const add = useAddToTrip();
  const open = useUi((s) => s.open);
  const toast = useUi((s) => s.toast);
  const [tripId, setTripId] = useState<string | null>(null);
  const [dayChoice, setDayChoice] = useState(0);
  const sorted = [...trips].sort((a, b) => Number(b.destinationId === o.destinationId) - Number(a.destinationId === o.destinationId));
  const trip = trips.find((t) => t.id === tripId) ?? sorted[0];

  return (
    <Sheet title="Add to a trip" onClose={onClose}
      footer={trips.length ? (
        <Button className="w-full" icon={Plus} disabled={!trip || add.isPending} onClick={() => trip && add.mutate(
          { tripId: trip.id, day: dayChoice, time: null, title: o.title, notes: "", itemType: o.itemType as ItemType, itemId: o.itemId },
          { onSuccess: () => { toast({ text: `Added to ${trip.title}`, sub: `Day ${dayChoice + 1}`, tone: "info" }); onClose(); } },
        )}>Add to Day {dayChoice + 1}</Button>
      ) : undefined}>
      <p className="-mt-1 mb-4 text-[14px] font-semibold">{o.title}</p>
      {isLoading && <div className="h-20 animate-pulse rounded-2xl bg-card" />}
      <div className="space-y-2">
        {sorted.map((t) => {
          const d = destinations.find((x) => x.id === t.destinationId);
          const on = trip?.id === t.id;
          return (
            <button key={t.id} onClick={() => { setTripId(t.id); setDayChoice(0); }} aria-pressed={on} className={cx("flex w-full items-center gap-3 rounded-2xl border p-3 text-left", on ? "border-accent bg-accent-soft" : "border-line bg-card")}>
              <Route size={18} className={on ? "text-accent" : "text-muted"} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{t.title}</div>
                <div className="truncate text-[12px] text-muted">{d?.name ?? "Anywhere"}{t.startDate ? ` · ${fmtRange(t.startDate, addDays(t.startDate, t.days - 1))}` : ""}</div>
              </div>
            </button>
          );
        })}
      </div>
      {trip && (
        <div className="mt-4">
          <span className="eyebrow mb-1.5 block text-muted">Day</span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: trip.days }, (_, i) => (
              <button key={i} onClick={() => setDayChoice(i)} aria-pressed={dayChoice === i} className={cx("rounded-xl px-3 py-1.5 text-[12.5px] font-bold", dayChoice === i ? "bg-accent text-white" : "bg-card text-muted")}>Day {i + 1}</button>
            ))}
          </div>
        </div>
      )}
      <Button variant="ghost" className="mt-4 w-full" icon={CirclePlus} onClick={() => { onClose(); open({ type: "newTrip", destinationId: o.destinationId ?? undefined, items: [{ itemType: o.itemType, itemId: o.itemId, title: o.title }] }); }}>
        Start a new trip with this
      </Button>
    </Sheet>
  );

}

export function AddStopSheet({ tripId, day, onClose }: { tripId: string; day: number; onClose: () => void }) {
  const { add } = useTripItemMutations(tripId);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Sheet title={`Add a stop · Day ${day + 1}`} onClose={onClose}
      footer={<Button className="w-full" icon={CirclePlus} disabled={!title.trim() || add.isPending} onClick={() => add.mutate([{ day, time: time || null, title: title.trim(), notes: notes.trim(), itemType: null, itemId: null }], { onSuccess: onClose })}>Add stop</Button>}>
      <div className="space-y-5">
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Time" hint="Optional"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="What"><input autoFocus className={inputCls} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Check in at the ryokan" /></Field>
        </div>
        <Field label="Notes"><textarea className={cx(inputCls, "min-h-[80px] resize-none")} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Booking ref, address, opening hours…" /></Field>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Community */

const REASONS: { v: ReportReason; l: string; d: string }[] = [
  { v: "unsafe", l: "Unsafe", d: "Dangerous, illegal or encourages harm" },
  { v: "inappropriate", l: "Inappropriate", d: "Offensive, hateful or explicit" },
  { v: "harassment", l: "Harassment", d: "Targets or bullies someone" },
  { v: "spam", l: "Spam or advertising", d: "Promotions, scams or repeated posts" },
  { v: "inaccurate", l: "Inaccurate", d: "Wrong place, closed, or misleading" },
  { v: "other", l: "Something else", d: "Tell us below" },
];

export function ReportSheet({ o, onClose }: { o: Extract<Overlay, { type: "report" }>; onClose: () => void }) {
  const report = useReport();
  const block = useToggleBlock();
  const toast = useUi((s) => s.toast);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  return (
    <Sheet title={`Report ${o.label}`} onClose={onClose}
      footer={<Button className="w-full" icon={Flag} disabled={!reason || report.isPending || (reason === "other" && details.trim().length < 5)}
        onClick={() => reason && report.mutate({ targetType: o.targetType, targetId: o.targetId, reason, details: details.trim() }, {
          onSuccess: () => {
            if (alsoBlock && o.authorId) block.mutate({ id: o.authorId, on: true });
            toast({ text: "Thanks for reporting", sub: "Moderators will review it. Repeated reports hide content automatically.", tone: "info" });
            onClose();
          },
        })}>Send report</Button>}>
      <p className="-mt-1 mb-4 text-[13.5px] text-muted">Reports are private. The person won't know who reported them.</p>
      <div className="space-y-2" role="radiogroup" aria-label="Reason">
        {REASONS.map((r) => (
          <button key={r.v} role="radio" aria-checked={reason === r.v} onClick={() => setReason(r.v)} className={cx("w-full rounded-2xl border p-3 text-left", reason === r.v ? "border-accent bg-accent-soft" : "border-line bg-card")}>
            <div className="text-[14px] font-bold">{r.l}</div>
            <div className="text-[12.5px] text-muted">{r.d}</div>
          </button>
        ))}
      </div>
      <textarea className={cx(inputCls, "mt-4 min-h-[80px] resize-none")} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything else moderators should know? (optional)" aria-label="Details" />
      {o.authorId && (
        <label className="mt-3 flex items-center gap-3 text-[13.5px]">
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="h-4 w-4 accent-[#B8361C]" />
          Also block this explorer
        </label>
      )}
    </Sheet>
  );
}

export function AddTipSheet({ destinationId, onClose }: { destinationId: string; onClose: () => void }) {
  const { data: destinations = [] } = useDestinations();
  const create = useCreateTip(destinationId);
  const [category, setCategory] = useState("Local secret");
  const [body, setBody] = useState("");
  const d = destinations.find((x) => x.id === destinationId);
  return (
    <Sheet title={`Field note · ${d?.name ?? ""}`} onClose={onClose}
      footer={<Button className="w-full" disabled={body.trim().length < 10 || create.isPending} onClick={() => create.mutate({ category, body: body.trim() }, { onSuccess: onClose })}>Publish · +40 XP</Button>}>
      <div className="space-y-5">
        <Field group label="Category">
          <div className="flex flex-wrap gap-2">
            {["Local secret", "Transit", "Food", "Timing", "Gear", "Money", "Safety"].map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
          </div>
        </Field>
        <Field label="Your tip" hint={`${body.trim().length}/500 · specific beats general: times, places, prices`}>
          <textarea autoFocus className={cx(inputCls, "min-h-[120px] resize-none")} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Arrive before 7 AM and take the north path…" />
        </Field>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Profile */

export function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe();
  const save = useUpdateProfile();
  const [draft, setDraft] = useState<Profile | null>(me ?? null);
  const [handleOk, setHandleOk] = useState(true);
  useEffect(() => setDraft((d) => d ?? me ?? null), [me]);
  useEffect(() => {
    if (!draft || draft.handle === me?.handle) return setHandleOk(true);
    if (!HANDLE_RE.test(draft.handle)) return setHandleOk(false);
    let alive = true;
    api.handleAvailable(draft.handle).then((ok) => alive && setHandleOk(ok));
    return () => {
      alive = false;
    };
  }, [draft?.handle, me?.handle]); // eslint-disable-line react-hooks/exhaustive-deps
  const watchingNames = useWatchingLabel(draft?.watching ?? []);
  if (!draft) return null;
  const set = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch });

  return (
    <Sheet full title="Edit profile" onClose={onClose}
      footer={<Button className="w-full" icon={Check} disabled={!draft.name.trim() || !handleOk || save.isPending}
        onClick={() => save.mutate({ name: draft.name.trim(), handle: draft.handle, home: draft.home, bio: draft.bio, hue: draft.hue, styles: draft.styles, visited: draft.visited, socials: draft.socials, visibility: draft.visibility }, { onSuccess: onClose })}>
        Save changes
      </Button>}>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={draft.name || draft.handle} hue={draft.hue} size={64} />
          <div className="flex gap-2">
            {[10, 40, 150, 200, 260, 320].map((h) => (
              <button key={h} aria-label={`Colour ${h}`} onClick={() => set({ hue: h })} className={cx("h-7 w-7 rounded-full", draft.hue === h && "ring-2 ring-ink ring-offset-2")} style={{ background: `hsl(${h} 60% 50%)` }} />
            ))}
          </div>
        </div>
        <Field label="Name"><input className={inputCls} maxLength={80} value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Handle" hint={handleOk ? undefined : "That handle is taken or invalid."}>
          <input className={inputCls} maxLength={30} value={draft.handle} onChange={(e) => set({ handle: e.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase() })} />
        </Field>
        <Field label="Home base"><input className={inputCls} maxLength={80} value={draft.home} onChange={(e) => set({ home: e.target.value })} /></Field>
        <Field label="Bio"><textarea className={cx(inputCls, "min-h-[80px] resize-none")} maxLength={300} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} /></Field>
        <Field group label="Travel styles">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STYLE_META) as TravelStyle[]).map((st) => (
              <Chip key={st} icon={STYLE_META[st].icon} active={draft.styles.includes(st)} onClick={() => set({ styles: draft.styles.includes(st) ? draft.styles.filter((x) => x !== st) : [...draft.styles, st] })}>{STYLE_META[st].label}</Chip>
            ))}
          </div>
        </Field>
        <Field group label={`Countries visited (${draft.visited.length})`}>
          <CountryPicker visited={draft.visited} onChange={(visited) => set({ visited })} />
        </Field>
        {watchingNames && <p className="text-[12.5px] text-muted">On your radar: {watchingNames}. Change these from each destination page.</p>}
        <div className="space-y-3">
          <span className="eyebrow block text-muted">Social profiles</span>
          {(["instagram", "x", "tiktok", "strava"] as (keyof SocialLinks)[]).map((k) => (
            <label key={k} className="relative block">
              <span className="absolute top-1/2 left-4 w-20 -translate-y-1/2 text-[12px] font-bold text-muted capitalize">{k === "x" ? "X" : k}</span>
              <input className={cx(inputCls, "pl-24")} maxLength={40} value={draft.socials[k] ?? ""} placeholder="handle" aria-label={`${k} handle`}
                onChange={(e) => set({ socials: { ...draft.socials, [k]: e.target.value.replace(/^@/, "").replace(/[^a-z0-9_.-]/gi, "") || undefined } })} />
            </label>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function useWatchingLabel(ids: string[]) {
  const { data: destinations = [] } = useDestinations();
  return useMemo(() => ids.map((id) => destinations.find((d) => d.id === id)?.name).filter(Boolean).join(", "), [ids, destinations]);
}
