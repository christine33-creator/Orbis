import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Bike, Camera, Coffee, Cpu, Leaf, Moon, Mountain, Palette, Shirt, Sparkles, Sun, Ticket, Trophy, Utensils, X,
  Landmark, Music, PartyPopper, Eye, Trees, Waves, Store, MapPin, type LucideIcon,
} from "lucide-react";
import type { GemCategory, PulseCategory, SceneKind, TravelStyle, TripStyle } from "../types";
import { cx } from "../lib/util";

export const STYLE_META: Record<TravelStyle, { icon: LucideIcon }> = {
  culture: { icon: Landmark },
  photography: { icon: Camera },
  vacation: { icon: Sun },
  adventure: { icon: Mountain },
  sports: { icon: Trophy },
  events: { icon: Ticket },
  food: { icon: Utensils },
  nightlife: { icon: Moon },
  eco: { icon: Leaf },
  tech: { icon: Cpu },
  fashion: { icon: Shirt },
  wellness: { icon: Coffee },
};

export const TRIP_STYLE_META: Record<TripStyle, { icon: LucideIcon }> = {
  vacation: { icon: Sun },
  culture: { icon: Landmark },
  adventure: { icon: Mountain },
  sports: { icon: Bike },
  events: { icon: Ticket },
  custom: { icon: Sparkles },
};

export const PULSE_META: Record<PulseCategory, { icon: LucideIcon }> = {
  sports: { icon: Trophy },
  tech: { icon: Cpu },
  fashion: { icon: Shirt },
  art: { icon: Palette },
  music: { icon: Music },
  food: { icon: Utensils },
  festival: { icon: PartyPopper },
  other: { icon: Sparkles },
};

export const GEM_CATEGORY_META: Record<GemCategory, { icon: LucideIcon; scene: SceneKind }> = {
  viewpoint: { icon: Eye, scene: "mountain" },
  food: { icon: Utensils, scene: "city" },
  nature: { icon: Trees, scene: "forest" },
  beach: { icon: Waves, scene: "coast" },
  culture: { icon: Landmark, scene: "temple" },
  shop: { icon: Store, scene: "city" },
  experience: { icon: Sparkles, scene: "water" },
  other: { icon: MapPin, scene: "mountain" },
};

export function Avatar({ name, hue, size = 40, ring, className }: { name: string; hue: number; size?: number; ring?: boolean; className?: string }) {
  const initials = name.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div
      className={cx("grid shrink-0 place-items-center rounded-full font-semibold text-white", ring && "ring-[3px] ring-white shadow-md", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 65% 58%), hsl(${(hue + 40) % 360} 55% 38%))`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={cx("block rounded-3xl bg-card", onClick && "w-full text-left", "shadow-[0_1px_2px_rgba(20,20,30,0.04),0_4px_16px_rgba(20,20,30,0.04)]", className)}>
      {children}
    </Tag>
  );
}

export function Chip({ children, active, onClick, icon: Icon, className }: { children: ReactNode; active?: boolean; onClick?: () => void; icon?: LucideIcon; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition",
        active ? "bg-accent text-white shadow-sm" : "border border-line bg-card text-ink hover:bg-chip",
        className,
      )}
    >
      {Icon && <Icon size={14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function Tag({ children, tone = "neutral", icon: Icon }: { children: ReactNode; tone?: "neutral" | "accent" | "green" | "dark"; icon?: LucideIcon }) {
  const tones = {
    neutral: "bg-chip text-muted",
    accent: "bg-accent-soft text-accent",
    green: "bg-mint text-green",
    dark: "bg-navy text-white",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide", tones[tone])}>
      {Icon && <Icon size={11} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export function Button({
  children, onClick, variant = "primary", icon: Icon, className, disabled, type = "button",
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "dark" | "ghost" | "soft" | "coral"; icon?: LucideIcon; className?: string; disabled?: boolean; type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-dark",
    coral: "bg-coral text-white hover:brightness-95",
    dark: "bg-navy text-white hover:bg-navy-2",
    ghost: "border border-line bg-card text-ink hover:bg-chip",
    soft: "bg-chip text-ink hover:bg-line",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition disabled:opacity-40", v[variant], className)}
    >
      {Icon && <Icon size={16} strokeWidth={2.3} />}
      {children}
    </button>
  );
}

export function SectionHeader({ eyebrow, title, action, onAction, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; onAction?: () => void; className?: string }) {
  return (
    <div className={cx("flex items-end justify-between gap-3", className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-1 text-accent">{eyebrow}</div>}
        <h2 className="font-display text-[26px] leading-tight font-semibold">{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className="shrink-0 pb-1 text-[13px] font-bold text-accent">
          {action}
        </button>
      )}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-green" : "bg-line")}
    >
      <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

/** Bottom sheet / full-screen overlay. */
export function Sheet({ title, onClose, children, full, footer }: { title?: ReactNode; onClose: () => void; children: ReactNode; full?: boolean; footer?: ReactNode }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="animate-fade absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className={cx("animate-sheet relative flex flex-col overflow-hidden bg-bg", full ? "h-full" : "max-h-[92%] rounded-t-[28px]")}
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          {full ? (
            <button onClick={onClose} aria-label={t("common.back")} className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm">
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1 font-display text-xl font-semibold">{title}</div>
          {!full && (
            <button onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-full bg-chip">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6">{children}</div>
        {footer && <div className="border-t border-line bg-card px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Labelled form row. Use `group` when the children are buttons (a <label> would forward clicks to the first one). */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const inner = (
    <>
      <span className="eyebrow mb-1.5 block text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className="block">{inner}</div>
  ) : (
    <label className="block">{inner}</label>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] outline-none placeholder:text-faint focus:border-accent";
