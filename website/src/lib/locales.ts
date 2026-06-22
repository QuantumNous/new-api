export const DEFAULT_LOCALE = "en";

export const LOCALES = ["en", "zh", "es", "fr", "pt", "ru", "ja", "vi", "de"] as const;

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
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.some((locale) => locale === value);
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
    LOCALES.map((locale) => [locale, `https://flatkey.ai${localizePath(stripped, locale)}`])
  );
}
