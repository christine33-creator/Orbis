import type { TFunction } from "i18next";
import { ApiError } from "../api/types";

/** Human-readable, translated text for any thrown error. */
export function errorText(t: TFunction, e: unknown): string {
  if (e instanceof ApiError) return t(`errors.${e.code}`, e.params ?? {});
  return t("errors.generic");
}
