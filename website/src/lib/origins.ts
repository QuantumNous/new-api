const DEFAULT_APP_CONSOLE_ORIGIN = "https://console.flatkey.ai";
const DEFAULT_ROUTER_ORIGIN = "https://router.flatkey.ai";
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

export const ROUTER_ORIGIN = normalizeOrigin(
  process.env.ROUTER_ORIGIN ?? process.env.NEXT_PUBLIC_ROUTER_ORIGIN,
  DEFAULT_ROUTER_ORIGIN
);

export const SITE_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN, DEFAULT_SITE_ORIGIN);

export function buildConsoleUrl(pathname = "/", origin = APP_CONSOLE_ORIGIN, search = ""): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedSearch = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `${normalizeOrigin(origin, DEFAULT_APP_CONSOLE_ORIGIN)}${path}${normalizedSearch}`;
}

export function consoleUrl(pathname = "/", search = ""): string {
  return buildConsoleUrl(pathname, APP_CONSOLE_ORIGIN, search);
}
