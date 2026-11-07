import { useState } from "react";
import { Ban, BookOpen, Check, EyeOff, Flag, LogOut, Mail, ShieldCheck, Trash2, X } from "lucide-react";
import { api } from "../../api";
import { queryClient } from "../../api/hooks";
import {
  useBlocks, useDestinations, useMe, useModQueue, useModerate, useProfile, useResolveReport, useToggleBlock,
  useUpdateProfile, useXpHistory,
} from "../../api/hooks";
import { useUi } from "../../store/ui";
import { useUpdates, Logo } from "../../components/Chrome";
import { EventRow, GemImage } from "../../components/Cards";
import { Button, Card, Field, Sheet, Tag, Toggle, inputCls } from "../../components/ui";
import { XP_AWARDS, XP_LABELS } from "../../lib/rules";
import { APP_NAME, APP_SLOGAN, cx } from "../../lib/util";
import type { Report } from "../../types";

/* ------------------------------------------------------------------ Auth */

export function AuthSheet({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const local = api.mode === "local";

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "link") {
      run(async () => {
        await api.sendMagicLink(email);
        if (local) onClose();
        else setSent(true);
      });
    } else {
      run(async () => {
        if (signUp) {
          const { needsConfirmation } = await api.signUpWithPassword(email, password);
          if (needsConfirmation) setSent(true);
          else onClose();
        } else {
          await api.signInWithPassword(email, password);
          onClose();
        }
      });
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="mx-auto w-fit"><Logo size={44} /></div>
        <h1 className="font-display mt-3 text-[28px] leading-tight font-semibold">{APP_SLOGAN}.</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] text-muted">{reason ?? `Join ${APP_NAME} to save places, plan trips and share hidden gems.`}</p>
      </div>

      {sent ? (
        <Card className="mt-5 p-5 text-center">
          <Mail className="mx-auto text-accent" size={30} />
          <h2 className="mt-2 text-[17px] font-bold">Check your email</h2>
          <p className="mt-1 text-[14px] text-muted">We sent a link to <b>{email}</b>. Open it on this device to sign in.</p>
          <button onClick={() => setSent(false)} className="mt-3 text-[13px] font-bold text-accent">Use a different email</button>
        </Card>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          {local && (
            <>
              <Button type="button" variant="dark" className="w-full py-3.5" disabled={busy} onClick={() => run(async () => { await startDemoProfile(); onClose(); })}>
                Explore with a ready-made demo profile
              </Button>
              <p className="rounded-2xl bg-chip p-3 text-[12.5px] text-muted">Or enter any email below to go through sign-up yourself. This is a demo: nothing is sent and data stays on this device.</p>
            </>
          )}
          <Field label="Email">
            <input id="auth-email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          {mode === "password" && (
            <Field label="Password" hint={signUp ? "At least 8 characters" : undefined}>
              <input id="auth-password" type="password" autoComplete={signUp ? "new-password" : "current-password"} required minLength={signUp ? 8 : 1} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          {error && <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent" role="alert">{error}</p>}
          <Button type="submit" className="w-full py-3.5" disabled={busy}>
            {busy ? "Please wait…" : mode === "link" ? (local ? "Continue" : "Email me a sign-in link") : signUp ? "Create account" : "Sign in"}
          </Button>
          <div className="flex justify-between text-[13px] font-bold text-accent">
            <button type="button" onClick={() => setMode(mode === "link" ? "password" : "link")}>{mode === "link" ? "Use a password instead" : "Use an email link instead"}</button>
            {mode === "password" && <button type="button" onClick={() => setSignUp(!signUp)}>{signUp ? "I have an account" : "Create an account"}</button>}
          </div>
          {!local && (
            <>
              <div className="flex items-center gap-3 py-1 text-[12px] text-faint"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>
              <Button type="button" variant="ghost" className="w-full" onClick={() => run(api.signInWithGoogle)}>Continue with Google</Button>
            </>
          )}
          <p className="pt-1 text-center text-[11.5px] text-faint">By continuing you agree to follow the community guidelines.</p>
        </form>
      )}
    </Sheet>
  );
}

/** Demo only: signs in as a pre-filled traveller with a couple of saves, skipping onboarding. */
async function startDemoProfile() {
  await api.sendMagicLink("sophia@demo.orbis");
  const me = await api.getMyProfile();
  if (me && !me.onboarded) {
    await api.updateMyProfile({
      handle: "sophiatravels", name: "Sophia Thorne", home: "Lisbon, Portugal", hue: 20,
      bio: "Alps enthusiast, specialty coffee hunter & architectural photographer.",
      styles: ["culture", "photography", "adventure", "food"],
      preferences: { pace: "balanced", budget: "comfort", company: "duo" },
      visited: ["Japan", "Italy", "Portugal", "Spain", "Iceland", "Mexico"], watching: ["kyoto", "lisbon"],
      socials: { instagram: "sophia.lens" }, visibility: "public", onboarded: true,
    });
    await api.setSaved("destination", "kyoto", true);
    await api.setSaved("gem", "gem-otagi", true);
    await api.setSaved("event", "event-kyoto-festival", true);
  }
  queryClient.invalidateQueries();
}

/* ------------------------------------------------------------------ Settings */

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe();
  const { data: blocks = [] } = useBlocks();
  const update = useUpdateProfile();
  const open = useUi((s) => s.open);
  const closeAll = useUi((s) => s.closeAll);
  const setTab = useUi((s) => s.setTab);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  if (!me) return null;

  const deleteAccount = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.deleteAccount();
      closeAll();
      setTab("explore");
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Sheet full title="Settings" onClose={onClose}>
      <section className="space-y-2">
        <h2 className="eyebrow text-muted">Privacy</h2>
        <Card className="flex items-center gap-3 p-4">
          <EyeOff size={18} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold">Private profile</div>
            <div className="text-[12.5px] text-muted">Hide your profile. Your gems stay visible without your name.</div>
          </div>
          <Toggle label="Private profile" on={me.visibility === "private"} onChange={(v) => update.mutate({ visibility: v ? "private" : "public" })} />
        </Card>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">Blocked explorers ({blocks.length})</h2>
        {blocks.map((id) => <BlockedRow key={id} id={id} />)}
        {blocks.length === 0 && <p className="rounded-2xl bg-chip p-3 text-[13px] text-muted">You haven't blocked anyone. Blocking hides someone's gems and notes from you and stops them following you.</p>}
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">Community</h2>
        <Card className="flex items-center gap-3 p-4" onClick={() => open({ type: "guidelines" })}>
          <BookOpen size={18} /> <span className="flex-1 text-[14px] font-bold">Community guidelines</span>
        </Card>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">Account</h2>
        <Card className="flex items-center gap-3 p-4" onClick={() => { api.signOut(); closeAll(); setTab("explore"); }}>
          <LogOut size={18} /> <span className="flex-1 text-[14px] font-bold">Sign out</span>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 text-accent"><Trash2 size={18} /> <span className="text-[14px] font-bold">Delete account</span></div>
          <p className="mt-1 text-[12.5px] text-muted">Permanently deletes your profile, gems, notes, saves and trips. This can't be undone.</p>
          <label className="mt-3 block text-[12.5px] font-semibold">Type <b>delete</b> to confirm
            <input className={cx(inputCls, "mt-1")} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type delete to confirm" />
          </label>
          {error && <p className="mt-2 text-[12.5px] font-semibold text-accent">{error}</p>}
          <Button className="mt-3 w-full" disabled={confirm.trim().toLowerCase() !== "delete" || deleting} onClick={deleteAccount}>{deleting ? "Deleting…" : "Delete my account"}</Button>
        </Card>
      </section>
      <p className="mt-6 text-center text-[11.5px] text-faint">{APP_NAME} · {api.mode === "local" ? "Demo mode" : "Connected"}</p>
    </Sheet>
  );
}

function BlockedRow({ id }: { id: string }) {
  const { data: p } = useProfile(id);
  const block = useToggleBlock();
  return (
    <Card className="flex items-center gap-3 p-3">
      <Ban size={16} className="text-muted" />
      <span className="flex-1 truncate text-[14px] font-semibold">{p ? `@${p.handle}` : "An explorer"}</span>
      <button onClick={() => block.mutate({ id, on: false })} className="rounded-full bg-chip px-3 py-1.5 text-[12px] font-bold">Unblock</button>
    </Card>
  );
}

/* ------------------------------------------------------------------ Moderation */

export function ModerationSheet({ onClose }: { onClose: () => void }) {
  const { data: me } = useMe();
  const isMod = me?.role === "moderator" || me?.role === "admin";
  const { data, isLoading, error } = useModQueue(isMod);
  const moderate = useModerate();
  const resolve = useResolveReport();
  const open = useUi((s) => s.open);
  const [note, setNote] = useState("");

  if (!isMod) return <Sheet title="Moderation" onClose={onClose}><p className="py-6 text-center text-muted">Only moderators can see this.</p></Sheet>;
  const total = (data?.gems.length ?? 0) + (data?.tips.length ?? 0) + (data?.reports.length ?? 0);
  const act = (type: "gem" | "tip", id: string, status: "published" | "rejected") => moderate.mutate({ type, id, status, note });

  return (
    <Sheet full title="Moderation queue" onClose={onClose}>
      {api.mode === "local" && <p className="mb-3 rounded-2xl bg-chip p-3 text-[12.5px] text-muted">In demo mode every account is a moderator so you can try this screen.</p>}
      <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the log (optional)" aria-label="Moderation note" />
      {isLoading && <div className="mt-4 h-32 animate-pulse rounded-3xl bg-card" />}
      {error && <p className="mt-4 text-accent">{(error as Error).message}</p>}
      {data && total === 0 && (
        <div className="mt-8 text-center">
          <ShieldCheck className="mx-auto text-green" size={36} />
          <p className="mt-2 font-bold">All clear</p>
          <p className="text-[13px] text-muted">Nothing waiting for review.</p>
        </div>
      )}
      {data && data.gems.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">Gems to review ({data.gems.length})</h2>
          {data.gems.map((g) => (
            <Card key={g.id} className="p-3">
              <button onClick={() => open({ type: "gem", id: g.id })} className="flex w-full items-center gap-3 text-left">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"><GemImage gem={g} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{g.name}</div>
                  <div className="line-clamp-2 text-[12.5px] text-muted">{g.description}</div>
                </div>
              </button>
              <div className="mt-2 flex items-center gap-2">
                <Tag tone="accent">{g.status === "pending" ? "Flagged on submit" : `${g.reports} reports`}</Tag>
                <span className="flex-1 truncate text-[12px] text-muted">by {g.author ? `@${g.author.handle}` : "private profile"}</span>
                <QueueButtons onApprove={() => act("gem", g.id, "published")} onReject={() => act("gem", g.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.tips.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">Field notes to review ({data.tips.length})</h2>
          {data.tips.map((t) => (
            <Card key={t.id} className="p-3">
              <p className="text-[13.5px]">{t.body}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 truncate text-[12px] text-muted">by {t.author ? `@${t.author.handle}` : "private profile"}</span>
                <QueueButtons onApprove={() => act("tip", t.id, "published")} onReject={() => act("tip", t.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.reports.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">Open reports ({data.reports.length})</h2>
          {data.reports.map((r) => <ReportRow key={r.id} r={r} onResolve={(s) => resolve.mutate({ id: r.id, status: s })} />)}
        </section>
      )}
    </Sheet>
  );
}

function QueueButtons({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <span className="flex shrink-0 gap-1.5">
      <button onClick={onApprove} className="flex items-center gap-1 rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold text-green"><Check size={13} /> Approve</button>
      <button onClick={onReject} className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent"><X size={13} /> Reject</button>
    </span>
  );
}

function ReportRow({ r, onResolve }: { r: Report; onResolve: (s: "resolved" | "dismissed") => void }) {
  const open = useUi((s) => s.open);
  const view = () => {
    if (r.targetType === "gem") open({ type: "gem", id: r.targetId });
    else if (r.targetType === "profile") open({ type: "profile", id: r.targetId });
    else if (r.targetType === "event") open({ type: "event", id: r.targetId });
  };
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Flag size={14} className="text-accent" />
        <span className="text-[13.5px] font-bold capitalize">{r.reason}</span>
        <span className="text-[12px] text-muted">on a {r.targetType}</span>
        <span className="flex-1" />
        {r.targetType !== "tip" && <button onClick={view} className="text-[12px] font-bold text-accent">View</button>}
      </div>
      {r.details && <p className="mt-1 text-[13px] text-muted">"{r.details}"</p>}
      <div className="mt-2 flex justify-end gap-1.5">
        <button onClick={() => onResolve("resolved")} className="rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold text-green">Resolved</button>
        <button onClick={() => onResolve("dismissed")} className="rounded-full bg-chip px-3 py-1.5 text-[12px] font-bold">Dismiss</button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Points, updates, guidelines */

export function XpLogSheet({ onClose }: { onClose: () => void }) {
  const { data: log = [] } = useXpHistory();
  const ways: [string, number][] = [
    ["Share a hidden gem", XP_AWARDS.gem_published], ["Plan a trip", XP_AWARDS.trip_created], ["Publish a field note", XP_AWARDS.tip_published],
    ["Check in at a stop", XP_AWARDS.stop_done], ["Stamp a country", XP_AWARDS.country_stamped], ["Save a place", XP_AWARDS.saved],
    ["Get an upvote on your gem", XP_AWARDS.upvote_received], ["Follow an explorer", XP_AWARDS.followed],
  ];
  return (
    <Sheet title="Explorer points" onClose={onClose}>
      <h3 className="eyebrow text-accent">Ways to earn</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ways.map(([l, n]) => <div key={l} className="rounded-2xl bg-card p-3 text-[12.5px] font-semibold shadow-sm">{l}<div className="mt-0.5 font-bold text-green">+{n} XP</div></div>)}
      </div>
      <p className="mt-2 text-[12px] text-muted">Each action earns points once, with daily limits to keep things fair.</p>
      <h3 className="eyebrow mt-6 text-accent">Recent activity</h3>
      <div className="mt-2 divide-y divide-line rounded-2xl bg-card shadow-sm">
        {log.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3 text-[13.5px]">
            <span className="truncate">{XP_LABELS[e.reason] ?? e.reason}</span>
            <span className="shrink-0 font-bold text-green">+{e.amount}</span>
          </div>
        ))}
        {log.length === 0 && <div className="p-4 text-center text-sm text-muted">No points yet.</div>}
      </div>
    </Sheet>
  );
}

export function UpdatesSheet({ onClose }: { onClose: () => void }) {
  const updates = useUpdates();
  const { data: destinations = [] } = useDestinations();
  return (
    <Sheet title="Updates" onClose={onClose}>
      <p className="-mt-1 mb-4 text-[13px] text-muted">Happenings at places you've saved or put on your radar.</p>
      <div className="space-y-3">
        {updates.map((e) => <EventRow key={e.id} ev={e} reason={destinations.find((d) => d.id === e.destinationId)?.name} />)}
        {updates.length === 0 && <p className="rounded-2xl bg-chip p-4 text-center text-[13.5px] text-muted">Save destinations to get updates about what's happening there.</p>}
      </div>
    </Sheet>
  );
}

export function GuidelinesSheet({ onClose }: { onClose: () => void }) {
  const rules = [
    ["Share real places you know", "Gems should be places you've been, described honestly. No made-up spots or copied reviews."],
    ["Respect people and places", "No hate, harassment or explicit content. Don't share private homes, or places where visitors aren't welcome."],
    ["Keep it safe and legal", "Don't encourage trespassing, dangerous stunts or damaging nature or heritage sites."],
    ["No advertising", "Links, phone numbers and promotions are held for review. Business owners shouldn't post their own business."],
    ["Protect privacy", "Don't post photos where strangers are identifiable without consent. Photo location data is removed automatically."],
    ["Report, don't retaliate", "Use Report and Block. Content reported by several people is hidden until a moderator reviews it."],
  ];
  return (
    <Sheet title="Community guidelines" onClose={onClose}>
      <p className="-mt-1 mb-4 text-[14px] text-muted">{APP_NAME} works because explorers trust what they find here.</p>
      <ol className="space-y-3">
        {rules.map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">{i + 1}</span>
            <div><div className="text-[14.5px] font-bold">{t}</div><p className="mt-0.5 text-[13px] text-muted">{d}</p></div>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
