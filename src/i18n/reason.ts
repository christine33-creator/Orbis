import type { TFunction } from "i18next";
import type { Reason } from "../lib/suggest";

/** Renders a suggestion reason in the current language. */
export function reasonText(t: TFunction, r: Reason | undefined): string {
  if (!r) return "";
  const styles = (r.styles ?? []).map((s) => t(`styleWords.${s}`)).join(t("reasons.and"));
  return t(`reasons.${r.key}`, { ...r.params, styles, style: styles });
}
