// GUI internationalization — en (base) / zh / vi.
//
// Convention (mirrors the monorepo web frontend): flat JSON locale files whose KEYS ARE
// THE ENGLISH SOURCE STRINGS. English needs no resource file — a missing key falls back
// to the key itself, which is the English copy. zh/vi translate what they cover; anything
// untranslated renders in English rather than breaking.
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import zh from "./locales/zh.json";
import vi from "./locales/vi.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "vi", label: "Tiếng Việt" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      vi: { translation: vi },
    },
    fallbackLng: false, // key === English source string, so the key IS the fallback
    supportedLngs: ["en", "zh", "vi"],
    nonExplicitSupportedLngs: true, // zh-CN / vi-VN from the OS match zh / vi
    keySeparator: false, // keys are sentences — "." and ":" are literal text
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    detection: {
      order: typeof localStorage !== "undefined" ? ["localStorage", "navigator"] : ["navigator"],
      caches: typeof localStorage !== "undefined" ? ["localStorage"] : [],
      lookupLocalStorage: "coworker.lang",
    },
  });

export function setLanguage(code: string) {
  // Explicit cache so language survives even if detector caches are empty (tests / SSR).
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem("coworker.lang", code);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(code);
}

export default i18n;
