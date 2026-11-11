import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AtSign, Ban, BookOpen, Check, Eye, EyeOff, Flag, KeyRound, Languages, LogOut, Mail, ShieldCheck, Trash2, X } from "lucide-react";
import { api, ApiError } from "../../api";
import { passwordRules, passwordStrength, passwordValid } from "../../lib/password";
import { queryClient } from "../../api/hooks";
import { resetLocalDb } from "../../api/local";
import {
  useBlocks, useDestinations, useMe, useModQueue, useModerate, useProfile, useResolveReport, useToggleBlock,
  useUpdateProfile, useXpHistory,
} from "../../api/hooks";
import { useUi } from "../../store/ui";
import { useUpdates, Logo } from "../../components/Chrome";
import { EventRow, GemImage } from "../../components/Cards";
import { LanguagePicker } from "../../components/LanguagePicker";
import { Button, Card, Field, Sheet, Tag, Toggle, inputCls } from "../../components/ui";
import { XP_AWARDS } from "../../lib/rules";
import { APP_NAME, cx } from "../../lib/util";
import { errorText } from "../../i18n/errors";
import { en } from "../../i18n/locales/en";
import type { Report } from "../../types";
import type { ModerationTarget } from "../../api/types";

/* ------------------------------------------------------------------ Auth */

type AuthMode = "signIn" | "signUp" | "link" | "forgot";

export function AuthSheet({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(api.mode === "local" ? "link" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; unverified?: boolean } | null>(null);
  const [sent, setSent] = useState<null | "verify" | "link" | "reset">(null);
  const [google, setGoogle] = useState(false);
  const local = api.mode === "local";

  useEffect(() => {
    let alive = true;
    api.authProviders().then((p) => alive && setGoogle(p.google));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError({ text: errorText(t, e), unverified: e instanceof ApiError && e.code === "emailNotConfirmed" });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signUp" && !passwordValid(password, email)) {
      setError({ text: t("errors.weakPassword") });
      return;
    }
    run(async () => {
      if (mode === "link") {
        await api.sendMagicLink(email);
        if (local) onClose();
        else setSent("link");
      } else if (mode === "forgot") {
        await api.requestPasswordReset(email);
        setSent("reset");
      } else if (mode === "signUp") {
        const { needsConfirmation } = await api.signUpWithPassword(email, password);
        if (needsConfirmation) setSent("verify");
        else onClose();
      } else {
        await api.signInWithPassword(email, password);
        onClose();
      }
    });
  };

  const title = mode === "forgot" ? t("auth.forgotTitle") : `${t("brand.slogan")}.`;

  return (
    <Sheet onClose={onClose}>
      <div className="pb-2 text-center">
        <div className="mx-auto w-fit"><Logo size={44} /></div>
        <h1 className="font-display mt-3 text-[28px] leading-tight font-semibold">{title}</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] text-muted">
          {mode === "forgot" ? t("auth.forgotSub") : (reason ?? t("auth.defaultReason", { app: APP_NAME }))}
        </p>
      </div>

      {sent ? (
        <Card className="mt-5 p-5 text-center">
          <Mail className="mx-auto text-accent" size={30} />
          <h2 className="mt-2 text-[17px] font-bold">{t("auth.checkEmail")}</h2>
          <p className="mt-1 text-[14px] text-muted">
            {sent === "verify" ? t("auth.sentVerify", { email }) : sent === "reset" ? t("auth.sentReset", { email }) : t("auth.sentLink", { email })}
          </p>
          {sent === "verify" && <ResendVerification email={email} />}
          <button onClick={() => { setSent(null); switchMode("signIn"); }} className="mt-3 text-[13px] font-bold text-accent">{t("auth.backToSignIn")}</button>
        </Card>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          {local && (
            <>
              <Button type="button" variant="dark" className="w-full py-3.5" disabled={busy} onClick={() => run(async () => { await startDemoProfile(); onClose(); })}>
                {t("auth.demoProfile")}
              </Button>
              <p className="rounded-2xl bg-chip p-3 text-[12.5px] text-muted">{t("auth.demoNote")}</p>
            </>
          )}
          {(mode === "signIn" || mode === "signUp") && (
            <div className="flex rounded-2xl bg-chip p-1" role="tablist">
              {(["signIn", "signUp"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                  className={cx("flex-1 rounded-xl py-2 text-[13px] font-bold transition", mode === m ? "bg-card shadow-sm" : "text-muted")}>
                  {m === "signIn" ? t("auth.signIn") : t("auth.createAccount")}
                </button>
              ))}
            </div>
          )}
          <Field label={t("auth.email")}>
            <input id="auth-email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          {(mode === "signIn" || mode === "signUp") && (
            <div>
              <Field label={t("auth.password")}>
                <div className="relative">
                  <input id="auth-password" type={showPw ? "text" : "password"} autoComplete={mode === "signUp" ? "new-password" : "current-password"} required
                    className={cx(inputCls, "pr-12")} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
                    className="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-chip">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              {mode === "signUp" && <PasswordChecklist password={password} email={email} />}
              {mode === "signIn" && (
                <button type="button" onClick={() => switchMode("forgot")} className="mt-2 text-[12.5px] font-bold text-accent">{t("auth.forgot")}</button>
              )}
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent" role="alert">
              {error.text}
              {error.unverified && <ResendVerification email={email} />}
            </div>
          )}
          <Button type="submit" className="w-full py-3.5" disabled={busy || !email.trim()}>
            {busy ? t("common.pleaseWait")
              : mode === "link" ? (local ? t("auth.continue") : t("auth.emailLink"))
              : mode === "forgot" ? t("auth.sendReset")
              : mode === "signUp" ? t("auth.createAccount") : t("auth.signIn")}
          </Button>
          <div className="flex justify-center text-[13px] font-bold text-accent">
            {mode === "link" || mode === "forgot" ? (
              <button type="button" onClick={() => switchMode("signIn")}>{t("auth.backToSignIn")}</button>
            ) : (
              <button type="button" onClick={() => switchMode("link")}>{t("auth.useLink")}</button>
            )}
          </div>
          {google && !local && mode !== "forgot" && (
            <>
              <div className="flex items-center gap-3 py-1 text-[12px] text-faint"><span className="h-px flex-1 bg-line" /> {t("auth.or")} <span className="h-px flex-1 bg-line" /></div>
              <Button type="button" variant="ghost" className="w-full" onClick={() => run(api.signInWithGoogle)}>{t("auth.google")}</Button>
            </>
          )}
          <p className="pt-1 text-center text-[11.5px] text-faint">{t("auth.agree")}</p>
        </form>
      )}
    </Sheet>
  );
}

/** "Resend email" with a cooldown, for sign-up confirmations. */
function ResendVerification({ email }: { email: string }) {
  const { t } = useTranslation();
  const [wait, setWait] = useState(0);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  return (
    <div className="mt-2">
      <button type="button" disabled={wait > 0 || !email} className="text-[13px] font-bold text-accent underline disabled:no-underline disabled:opacity-50"
        onClick={async () => {
          setMsg("");
          try {
            await api.resendVerification(email);
            setMsg(t("auth.resent"));
            setWait(60);
          } catch (e) {
            setMsg(errorText(t, e));
          }
        }}>
        {wait ? t("auth.resendIn", { s: wait }) : t("auth.resend")}
      </button>
      {msg && <p className="mt-1 text-[12px] text-muted" role="status">{msg}</p>}
    </div>
  );
}

/** Live checklist + strength meter for new passwords. */
export function PasswordChecklist({ password, email = "" }: { password: string; email?: string }) {
  const { t } = useTranslation();
  const rules = passwordRules(password, email);
  const strength = passwordStrength(password);
  const colors = ["bg-line", "bg-accent", "bg-coral", "bg-[#D9A23B]", "bg-green"];
  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={cx("h-1.5 flex-1 rounded-full", strength >= i ? colors[strength] : "bg-line")} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        {(Object.keys(rules) as (keyof typeof rules)[]).map((k) => (
          <li key={k} className={cx("flex items-center gap-1.5", rules[k] ? "text-green" : "text-muted")}>
            {rules[k] ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-faint" />} {t(`auth.rules.${k}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Opened after a password-reset link, and from Settings. */
export function PasswordSheet({ mode, onClose }: { mode: "reset" | "change"; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useUi((s) => s.user);
  const toast = useUi((s) => s.toast);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const email = user?.email ?? "";
  const mismatch = confirm.length > 0 && pw !== confirm;
  const ok = passwordValid(pw, email) && pw === confirm && (mode === "reset" || current.length > 0);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.updatePassword(pw, mode === "change" ? current : undefined);
      toast({ text: t("auth.passwordUpdated"), tone: "info" });
      onClose();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={mode === "reset" ? t("auth.setNewPassword") : t("settings.changePassword")} onClose={onClose}
      footer={<Button className="w-full" disabled={!ok || busy} onClick={save}>{busy ? t("common.pleaseWait") : t("auth.savePassword")}</Button>}>
      <div className="space-y-4">
        {mode === "change" && (
          <Field label={t("auth.currentPassword")}>
            <input id="pw-current" type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        )}
        <Field label={t("auth.newPassword")}>
          <input id="pw-new" type="password" autoComplete="new-password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <PasswordChecklist password={pw} email={email} />
        <Field label={t("auth.confirmPassword")} hint={mismatch ? t("auth.mismatch") : undefined}>
          <input id="pw-confirm" type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

export function ChangeEmailSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const user = useUi((s) => s.user);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <Sheet title={t("settings.changeEmail")} onClose={onClose}
      footer={done ? undefined : (
        <Button className="w-full" disabled={busy || !email.trim() || email.trim().toLowerCase() === user?.email}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api.changeEmail(email);
              setDone(true);
            } catch (e) {
              setError(errorText(t, e));
            } finally {
              setBusy(false);
            }
          }}>
          {busy ? t("common.pleaseWait") : t("settings.sendConfirmation")}
        </Button>
      )}>
      {done ? (
        <Card className="p-5 text-center">
          <Mail className="mx-auto text-accent" size={30} />
          <p className="mt-2 text-[14px]">{t("settings.emailChangeSent", { email })}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-[13.5px] text-muted">{t("settings.currentEmail", { email: user?.email ?? "" })}</p>
          <Field label={t("settings.newEmail")}>
            <input id="new-email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="rounded-2xl bg-accent-soft p-3 text-[13px] font-semibold text-accent" role="alert">{error}</p>}
        </div>
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
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: blocks = [] } = useBlocks();
  const update = useUpdateProfile();
  const open = useUi((s) => s.open);
  const closeAll = useUi((s) => s.closeAll);
  const setTab = useUi((s) => s.setTab);
  const user = useUi((s) => s.user);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  if (!me) return null;
  const deleteWord = t("settings.deleteWord");

  const deleteAccount = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.deleteAccount();
      closeAll();
      setTab("explore");
    } catch (e) {
      setError(errorText(t, e));
      setDeleting(false);
    }
  };

  return (
    <Sheet full title={t("settings.title")} onClose={onClose}>
      <section className="space-y-2">
        <h2 className="eyebrow flex items-center gap-1.5 text-muted"><Languages size={13} /> {t("settings.language")}</h2>
        <LanguagePicker onChange={(language) => update.mutate({ preferences: { ...me.preferences, language } })} />
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">{t("settings.privacy")}</h2>
        <Card className="flex items-center gap-3 p-4">
          <EyeOff size={18} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold">{t("settings.privateProfile")}</div>
            <div className="text-[12.5px] text-muted">{t("settings.privateProfileSub")}</div>
          </div>
          <Toggle label={t("settings.privateProfile")} on={me.visibility === "private"} onChange={(v) => update.mutate({ visibility: v ? "private" : "public" })} />
        </Card>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">{t("settings.blocked", { count: blocks.length })}</h2>
        {blocks.map((id) => <BlockedRow key={id} id={id} />)}
        {blocks.length === 0 && <p className="rounded-2xl bg-chip p-3 text-[13px] text-muted">{t("settings.noBlocked")}</p>}
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">{t("settings.community")}</h2>
        <Card className="flex items-center gap-3 p-4" onClick={() => open({ type: "guidelines" })}>
          <BookOpen size={18} /> <span className="flex-1 text-[14px] font-bold">{t("settings.guidelines")}</span>
        </Card>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="eyebrow text-muted">{t("settings.account")}</h2>
        {api.mode === "supabase" && (
          <>
            <Card className="flex items-center gap-3 p-4" onClick={() => open({ type: "changeEmail" })}>
              <AtSign size={18} /> <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{t("settings.changeEmail")}</span><span className="block truncate text-[12px] text-muted">{user?.email}</span></span>
            </Card>
            <Card className="flex items-center gap-3 p-4" onClick={() => open({ type: "changePassword" })}>
              <KeyRound size={18} /> <span className="flex-1 text-[14px] font-bold">{t("settings.changePassword")}</span>
            </Card>
          </>
        )}
        <Card className="flex items-center gap-3 p-4" onClick={() => { api.signOut(); closeAll(); setTab("explore"); }}>
          <LogOut size={18} /> <span className="flex-1 text-[14px] font-bold">{t("settings.signOut")}</span>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 text-accent"><Trash2 size={18} /> <span className="text-[14px] font-bold">{t("settings.deleteAccount")}</span></div>
          <p className="mt-1 text-[12.5px] text-muted">{t("settings.deleteWarning")}</p>
          <label className="mt-3 block text-[12.5px] font-semibold">{t("settings.typeDelete", { word: deleteWord })}
            <input className={cx(inputCls, "mt-1")} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label={t("settings.typeDelete", { word: deleteWord })} />
          </label>
          {error && <p className="mt-2 text-[12.5px] font-semibold text-accent">{error}</p>}
          <Button className="mt-3 w-full" disabled={confirm.trim().toLowerCase() !== deleteWord.toLowerCase() || deleting} onClick={deleteAccount}>
            {deleting ? t("settings.deleting") : t("settings.deleteMine")}
          </Button>
        </Card>
      </section>
      {api.mode === "local" && (
        <Button variant="ghost" className="mt-6 w-full" onClick={() => { resetLocalDb(); window.location.reload(); }}>{t("settings.resetDemo")}</Button>
      )}
      <p className="mt-6 text-center text-[11.5px] text-faint">{t("settings.mode", { app: APP_NAME, mode: api.mode === "local" ? t("settings.demoMode") : t("settings.connected") })}</p>
    </Sheet>
  );
}

function BlockedRow({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data: p } = useProfile(id);
  const block = useToggleBlock();
  return (
    <Card className="flex items-center gap-3 p-3">
      <Ban size={16} className="text-muted" />
      <span className="flex-1 truncate text-[14px] font-semibold">{p ? `@${p.handle}` : t("common.anExplorer")}</span>
      <button onClick={() => block.mutate({ id, on: false })} className="rounded-full bg-chip px-3 py-1.5 text-[12px] font-bold">{t("common.unblock")}</button>
    </Card>
  );
}

/* ------------------------------------------------------------------ Moderation */

export function ModerationSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const isMod = me?.role === "moderator" || me?.role === "admin";
  const { data, isLoading, error } = useModQueue(isMod);
  const moderate = useModerate();
  const resolve = useResolveReport();
  const open = useUi((s) => s.open);
  const [note, setNote] = useState("");

  if (!isMod) return <Sheet title={t("moderation.title")} onClose={onClose}><p className="py-6 text-center text-muted">{t("moderation.onlyMods")}</p></Sheet>;
  const total = (data?.gems.length ?? 0) + (data?.tips.length ?? 0) + (data?.posts.length ?? 0) + (data?.comments.length ?? 0) + (data?.communities.length ?? 0) + (data?.reports.length ?? 0);
  const act = (type: ModerationTarget, id: string, status: "published" | "rejected") => moderate.mutate({ type, id, status, note });
  const by = (a: { handle: string } | null) => t("moderation.by", { who: a ? `@${a.handle}` : t("common.privateExplorer") });

  return (
    <Sheet full title={t("moderation.title")} onClose={onClose}>
      {api.mode === "local" && <p className="mb-3 rounded-2xl bg-chip p-3 text-[12.5px] text-muted">{t("moderation.demoNote")}</p>}
      <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("moderation.notePh")} aria-label={t("moderation.notePh")} />
      {isLoading && <div className="mt-4 h-32 animate-pulse rounded-3xl bg-card" />}
      {error && <p className="mt-4 text-accent">{errorText(t, error)}</p>}
      {data && total === 0 && (
        <div className="mt-8 text-center">
          <ShieldCheck className="mx-auto text-green" size={36} />
          <p className="mt-2 font-bold">{t("moderation.allClear")}</p>
          <p className="text-[13px] text-muted">{t("moderation.nothingWaiting")}</p>
        </div>
      )}
      {data && data.gems.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">{t("moderation.gemsToReview", { count: data.gems.length })}</h2>
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
                <Tag tone="accent">{g.status === "pending" ? t("moderation.flagged") : t("moderation.reportsN", { count: g.reports })}</Tag>
                <span className="flex-1 truncate text-[12px] text-muted">{by(g.author)}</span>
                <QueueButtons onApprove={() => act("gem", g.id, "published")} onReject={() => act("gem", g.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.tips.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">{t("moderation.notesToReview", { count: data.tips.length })}</h2>
          {data.tips.map((tip) => (
            <Card key={tip.id} className="p-3">
              <p className="text-[13.5px]">{tip.body}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 truncate text-[12px] text-muted">{by(tip.author)}</span>
                <QueueButtons onApprove={() => act("tip", tip.id, "published")} onReject={() => act("tip", tip.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.communities.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">{t("moderation.communitiesToReview", { count: data.communities.length })}</h2>
          {data.communities.map((c) => (
            <Card key={c.id} className="p-3">
              <button onClick={() => open({ type: "community", id: c.id })} className="w-full text-left">
                <div className="truncate font-bold">{c.name}</div>
                <div className="line-clamp-2 text-[12.5px] text-muted">{c.description}</div>
              </button>
              <div className="mt-2 flex items-center gap-2">
                <Tag tone="accent">{c.status === "pending" ? t("moderation.flagged") : t("community.status.hidden")}</Tag>
                <span className="flex-1" />
                <QueueButtons onApprove={() => act("community", c.id, "published")} onReject={() => act("community", c.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.posts.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">{t("moderation.postsToReview", { count: data.posts.length })}</h2>
          {data.posts.map((p) => (
            <Card key={p.id} className="p-3">
              <button onClick={() => open({ type: "post", id: p.id })} className="w-full text-left">
                <div className="text-[11px] font-bold tracking-wide text-accent uppercase">{p.community?.name}</div>
                <div className="truncate font-bold">{p.title}</div>
                <div className="line-clamp-2 text-[12.5px] text-muted">{p.body}</div>
              </button>
              <div className="mt-2 flex items-center gap-2">
                <Tag tone="accent">{p.status === "pending" ? t("moderation.flagged") : t("moderation.reportsN", { count: p.reports })}</Tag>
                <span className="flex-1 truncate text-[12px] text-muted">{by(p.author)}</span>
                <QueueButtons onApprove={() => act("post", p.id, "published")} onReject={() => act("post", p.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.comments.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">{t("moderation.commentsToReview", { count: data.comments.length })}</h2>
          {data.comments.map((c) => (
            <Card key={c.id} className="p-3">
              <button onClick={() => open({ type: "post", id: c.postId })} className="w-full text-left text-[13.5px]">{c.body}</button>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 truncate text-[12px] text-muted">{by(c.author)}</span>
                <QueueButtons onApprove={() => act("comment", c.id, "published")} onReject={() => act("comment", c.id, "rejected")} />
              </div>
            </Card>
          ))}
        </section>
      )}
      {data && data.reports.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="eyebrow text-muted">{t("moderation.openReports", { count: data.reports.length })}</h2>
          {data.reports.map((r) => <ReportRow key={r.id} r={r} onResolve={(s) => resolve.mutate({ id: r.id, status: s })} />)}
        </section>
      )}
    </Sheet>
  );
}

function QueueButtons({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  return (
    <span className="flex shrink-0 gap-1.5">
      <button onClick={onApprove} className="flex items-center gap-1 rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold text-green"><Check size={13} /> {t("moderation.approve")}</button>
      <button onClick={onReject} className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent"><X size={13} /> {t("moderation.reject")}</button>
    </span>
  );
}

function ReportRow({ r, onResolve }: { r: Report; onResolve: (s: "resolved" | "dismissed") => void }) {
  const { t } = useTranslation();
  const open = useUi((s) => s.open);
  const view = () => {
    if (r.targetType === "gem") open({ type: "gem", id: r.targetId });
    else if (r.targetType === "profile") open({ type: "profile", id: r.targetId });
    else if (r.targetType === "event") open({ type: "event", id: r.targetId });
    else if (r.targetType === "community") open({ type: "community", id: r.targetId });
    else if (r.targetType === "post") open({ type: "post", id: r.targetId });
  };
  const kind = {
    gem: t("map.kindGem"), tip: t("detail.fieldNotes"), profile: t("detail.profile"), event: t("map.kindEvent"),
    community: t("community.community"), post: t("community.post"), comment: t("community.what.comment"),
  }[r.targetType];
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Flag size={14} className="text-accent" />
        <span className="text-[13.5px] font-bold">{t(`forms.reasons.${r.reason}.l`)}</span>
        <span className="text-[12px] text-muted">{t("moderation.onA", { type: kind.toLowerCase() })}</span>
        <span className="flex-1" />
        {r.targetType !== "tip" && r.targetType !== "comment" && <button onClick={view} className="text-[12px] font-bold text-accent">{t("moderation.view")}</button>}
      </div>
      {r.details && <p className="mt-1 text-[13px] text-muted">"{r.details}"</p>}
      <div className="mt-2 flex justify-end gap-1.5">
        <button onClick={() => onResolve("resolved")} className="rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold text-green">{t("moderation.resolved")}</button>
        <button onClick={() => onResolve("dismissed")} className="rounded-full bg-chip px-3 py-1.5 text-[12px] font-bold">{t("moderation.dismiss")}</button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Points, updates, guidelines */

export function XpLogSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: log = [] } = useXpHistory();
  const ways = [
    [t("points.shareGem"), XP_AWARDS.gem_published], [t("points.planTrip"), XP_AWARDS.trip_created], [t("points.publishNote"), XP_AWARDS.tip_published],
    [t("points.checkIn"), XP_AWARDS.stop_done], [t("points.stamp"), XP_AWARDS.country_stamped], [t("points.save"), XP_AWARDS.saved],
    [t("points.upvote"), XP_AWARDS.upvote_received], [t("points.follow"), XP_AWARDS.followed],
    [t("points.post"), XP_AWARDS.post_published], [t("points.comment"), XP_AWARDS.comment_published], [t("points.like"), XP_AWARDS.like_received],
    [t("points.join"), XP_AWARDS.community_joined], [t("points.createCommunity"), XP_AWARDS.community_created],
  ] as const;
  const label = (reason: string) => (reason in en.xp ? t(`xp.${reason as keyof typeof en.xp}`) : reason);
  return (
    <Sheet title={t("points.title")} onClose={onClose}>
      <h3 className="eyebrow text-accent">{t("points.ways")}</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ways.map(([l, n]) => <div key={l} className="rounded-2xl bg-card p-3 text-[12.5px] font-semibold shadow-sm">{l}<div className="mt-0.5 font-bold text-green">+{n} XP</div></div>)}
      </div>
      <p className="mt-2 text-[12px] text-muted">{t("points.fair")}</p>
      <h3 className="eyebrow mt-6 text-accent">{t("points.recent")}</h3>
      <div className="mt-2 divide-y divide-line rounded-2xl bg-card shadow-sm">
        {log.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3 text-[13.5px]">
            <span className="truncate">{label(e.reason)}</span>
            <span className="shrink-0 font-bold text-green">+{e.amount}</span>
          </div>
        ))}
        {log.length === 0 && <div className="p-4 text-center text-sm text-muted">{t("points.none")}</div>}
      </div>
    </Sheet>
  );
}

export function UpdatesSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const updates = useUpdates();
  const { data: destinations = [] } = useDestinations();
  return (
    <Sheet title={t("updates.title")} onClose={onClose}>
      <p className="-mt-1 mb-4 text-[13px] text-muted">{t("updates.sub")}</p>
      <div className="space-y-3">
        {updates.map((e) => <EventRow key={e.id} ev={e} reason={destinations.find((d) => d.id === e.destinationId)?.name} />)}
        {updates.length === 0 && <p className="rounded-2xl bg-chip p-4 text-center text-[13.5px] text-muted">{t("updates.empty")}</p>}
      </div>
    </Sheet>
  );
}

const RULES = ["real", "respect", "safe", "ads", "privacy", "report"] as const;

export function GuidelinesSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet title={t("guidelines.title")} onClose={onClose}>
      <p className="-mt-1 mb-4 text-[14px] text-muted">{t("guidelines.intro", { app: APP_NAME })}</p>
      <ol className="space-y-3">
        {RULES.map((k, i) => (
          <li key={k} className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">{i + 1}</span>
            <div><div className="text-[14.5px] font-bold">{t(`guidelines.rules.${k}.t`)}</div><p className="mt-0.5 text-[13px] text-muted">{t(`guidelines.rules.${k}.d`)}</p></div>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
