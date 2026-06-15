const DEFAULT_APP_CONSOLE_ORIGIN = "https://router.flatkey.ai";
const DEFAULT_SITE_ORIGIN = "https://flatkey.ai";

export function normalizeOrigin(origin: string | undefined, fallback: string): string {
  const value = origin?.trim();
  if (!value) return fallback;
  return value.replace(/\/+$/, "");
}

export const APP_CONSOLE_ORIGIN = normalizeOrigin(
  process.env.APP_CONSOLE_ORIGIN ?? process.env.NEXT_PUBLIC_APP_CONSOLE_ORIGIN,
  DEFAULT_APP_CONSOLE_ORIGIN
);

export const SITE_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN, DEFAULT_SITE_ORIGIN);

export function consoleUrl(pathname = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${APP_CONSOLE_ORIGIN}${path}`;
}
