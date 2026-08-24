export const DEFAULT_LOCALE = "en";

export const LOCALES = ["en", "zh", "es", "fr", "pt", "ru", "ja", "vi", "de", "id"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
  fr: "Français",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  vi: "Tiếng Việt",
  de: "Deutsch",
  id: "Bahasa Indonesia",
};

/**
 * Stable BCP 47 tags used in rendered HTML, hreflang and XML sitemaps.
 * URL segments and application state intentionally keep the short locale keys.
 */
export const LOCALE_LANGUAGE_TAGS: Record<Locale, string> = {
  en: "en-US",
  zh: "zh-CN",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-BR",
  ru: "ru-RU",
  ja: "ja-JP",
  vi: "vi-VN",
  de: "de-DE",
  id: "id-ID",
};

export function localeLanguageTag(locale: Locale): string {
  return LOCALE_LANGUAGE_TAGS[locale];
}

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

// Fill the `id` (Bahasa Indonesia) locale with the English value when a copy map
// hasn't been translated to Indonesian yet. Lets us ship the Indonesian homepage +
// market landing first, while every other surface falls back to English until
// translated. Pass a map that already covers `en`; `id` is optional.
export function withIdFallback<T>(
  map: Record<Exclude<Locale, "id">, T> & Partial<Record<"id", T>>
): Record<Locale, T> {
  return { ...map, id: map.id ?? map.en } as Record<Locale, T>;
}

export function resolveLocaleFromPathname(pathname: string | null | undefined): Locale {
  if (!pathname) return DEFAULT_LOCALE;
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const [, firstSegment] = normalized.split("/");
  return isLocale(firstSegment) ? firstSegment : DEFAULT_LOCALE;
}

export function localizePath(pathname: string, locale: Locale): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === DEFAULT_LOCALE) return normalized;
  if (normalized === "/") return `/${locale}`;
  return `/${locale}${normalized}`;
}

export function stripLocale(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const [, firstSegment, ...rest] = normalized.split("/");
  if (!isLocale(firstSegment)) return normalized;
  const stripped = `/${rest.join("/")}`;
  return stripped === "/" ? "/" : stripped.replace(/\/+$/, "");
}

export function localeAlternates(pathname: string): Record<string, string> {
  const stripped = stripLocale(pathname);
  return Object.fromEntries(
    LOCALES.map((locale) => [localeLanguageTag(locale), `https://flatkey.ai${localizePath(stripped, locale)}`])
  );
}
