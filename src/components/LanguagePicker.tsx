import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LANGUAGES, setLanguage, type LanguageCode } from "../i18n";
import { inputCls } from "./ui";
import { cx } from "../lib/util";

/** Language selector. `onChange` lets callers also save the choice to the profile. */
export function LanguagePicker({ onChange, className }: { onChange?: (code: LanguageCode) => void; className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <label className={cx("relative block", className)}>
      <Languages size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
      <select
        id="language"
        aria-label={t("settings.language")}
        className={cx(inputCls, "pl-10")}
        value={i18n.resolvedLanguage}
        onChange={(e) => {
          const code = e.target.value as LanguageCode;
          setLanguage(code);
          onChange?.(code);
        }}
      >
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
