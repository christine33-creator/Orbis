import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { pt } from "./locales/pt";
import { de } from "./locales/de";
import { ja } from "./locales/ja";

/** Supported languages, labelled in their own language. Add a locale file and a row here to add one. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "orbis-lang";
const isSupported = (c: string | null | undefined): c is LanguageCode => !!c && LANGUAGES.some((l) => l.code === c);

/** Saved choice first, then the device's preferred languages, then English. */
export function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isSupported(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const prefs = typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
  for (const p of prefs) {
    const base = p?.toLowerCase().split("-")[0];
    if (isSupported(base)) return base;
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es }, fr: { translation: fr }, pt: { translation: pt }, de: { translation: de }, ja: { translation: ja } },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

const applyHtmlLang = (lng: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
};
applyHtmlLang(i18n.language);
i18n.on("languageChanged", applyHtmlLang);

export function setLanguage(code: LanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable */
  }
  return i18n.changeLanguage(code);
}

export default i18n;
