import { DEFAULT_LOCALE, type Locale, isLocale, localizePath } from "./locales";

export const LANGUAGE_PREFERENCE_COOKIE = "fk_locale";

const BOT_USER_AGENT_PATTERN =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|OAI-SearchBot|GPTBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|claude-code|PerplexityBot|Perplexity-User/i;

const IGNORED_PATH_PREFIXES = ["/_next", "/api", "/cdn-cgi", "/sign-in", "/sign-up", "/dashboard"];
const IGNORED_EXACT_PATHS = ["/favicon.ico", "/robots.txt", "/sitemap.xml", "/llms.txt", "/install.sh", "/install.ps1"];
const PUBLIC_FILE_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;

type LanguageRedirectInput = {
  pathname: string;
  method: string;
  acceptLanguage?: string | null;
  cookieLocale?: string | null;
  userAgent?: string | null;
};

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return BOT_USER_AGENT_PATTERN.test(userAgent ?? "");
}

export function resolvePreferredLocale(cookieLocale: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieLocale ?? undefined)) return cookieLocale as Locale;

  for (const languageRange of parseAcceptLanguage(acceptLanguage)) {
    const exact = languageRange.toLowerCase();
    if (isLocale(exact)) return exact;

    const base = exact.split("-")[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

export function getLanguageRedirectPath(input: LanguageRedirectInput): string | null {
  if (input.method !== "GET") return null;
  if (isBotUserAgent(input.userAgent)) return null;

  const pathname = normalizePathname(input.pathname);
  if (shouldIgnorePath(pathname)) return null;
  if (hasLocalePrefix(pathname)) return null;

  const locale = resolvePreferredLocale(input.cookieLocale, input.acceptLanguage);
  if (locale === DEFAULT_LOCALE) return null;

  return localizePath(pathname, locale);
}

export function buildLanguagePreferenceCookie(locale: Locale, domain?: string | null): string {
  const normalizedDomain = domain?.trim();
  const domainAttribute = normalizedDomain ? `; Domain=${normalizedDomain}` : "";
  return `${LANGUAGE_PREFERENCE_COOKIE}=${locale}; Path=/${domainAttribute}; Max-Age=31536000; SameSite=Lax`;
}

export function buildLanguagePreferenceCookieWrites(locale: Locale, domain?: string | null): string[] {
  const normalizedDomain = domain?.trim();
  if (!normalizedDomain) {
    return [buildLanguagePreferenceCookie(locale)];
  }

  return [
    `${LANGUAGE_PREFERENCE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    buildLanguagePreferenceCookie(locale, normalizedDomain),
  ];
}

function parseAcceptLanguage(acceptLanguage: string | null | undefined): string[] {
  if (!acceptLanguage) return [];

  return acceptLanguage
    .split(",")
    .map((part) => {
      const [range, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim().match(/^q=([0-9.]+)$/i)?.[1])
        .find(Boolean);
      return {
        range: range?.trim(),
        quality: q ? Number(q) : 1,
      };
    })
    .filter((item): item is { range: string; quality: number } => Boolean(item.range) && Number.isFinite(item.quality) && item.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((item) => item.range);
}

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function hasLocalePrefix(pathname: string): boolean {
  const firstSegment = pathname.split("/")[1];
  return isLocale(firstSegment);
}

function shouldIgnorePath(pathname: string): boolean {
  if (IGNORED_EXACT_PATHS.includes(pathname)) return true;
  if (IGNORED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  return pathname !== "/" && PUBLIC_FILE_EXTENSION_PATTERN.test(pathname);
}
