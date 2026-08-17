export const CONSOLE_SESSION_HINT_COOKIE_NAME = "flatkey_console_session_hint";
export const CONSOLE_SESSION_HINT_STORAGE_KEY = "flatkey:console-session";

const HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ConsoleCurrentUserPayload = {
  data?: {
    id?: unknown;
  } | null;
  success?: unknown;
};

type ConsoleRequestCookieStore = {
  get(name: string): { value?: string } | undefined;
};

export function hasConsoleSessionHintCookie(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${CONSOLE_SESSION_HINT_COOKIE_NAME}=1`);
}

export function hasConsoleSessionHintFromRequestCookieStore(
  cookieStore: ConsoleRequestCookieStore,
): boolean {
  return cookieStore.get(CONSOLE_SESSION_HINT_COOKIE_NAME)?.value === "1";
}

export function hasConsoleSessionHint(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(CONSOLE_SESSION_HINT_STORAGE_KEY) === "1") {
      return true;
    }
  } catch {
    /* ignore storage failures */
  }

  return hasConsoleSessionHintCookie(document.cookie);
}

export function rememberConsoleSessionHint() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CONSOLE_SESSION_HINT_STORAGE_KEY, "1");
  } catch {
    /* ignore storage failures */
  }

  for (const cookie of buildConsoleSessionHintCookieWrites({
    maxAge: HINT_MAX_AGE_SECONDS,
  })) {
    document.cookie = cookie;
  }
}

export function clearConsoleSessionHint() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CONSOLE_SESSION_HINT_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }

  for (const cookie of buildConsoleSessionHintCookieWrites({ maxAge: 0 })) {
    document.cookie = cookie;
  }
}

export function isVerifiedConsoleUserPayload(
  payload: unknown,
): payload is ConsoleCurrentUserPayload {
  if (!payload || typeof payload !== "object") return false;

  const value = payload as ConsoleCurrentUserPayload;
  if (value.success !== true || !value.data || typeof value.data !== "object") {
    return false;
  }

  const id = value.data.id;
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

export function sharedCookieDomainForHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || normalized === "localhost" || !normalized.includes(".")) {
    return null;
  }
  if (normalized === "flatkey.ai" || normalized.endsWith(".flatkey.ai")) {
    return ".flatkey.ai";
  }
  return null;
}

export function buildConsoleSessionHintCookieWrites(input: {
  maxAge: number;
}): string[] {
  if (typeof window === "undefined") return [];

  const attrs = [
    "path=/",
    `max-age=${Math.max(0, input.maxAge)}`,
    "SameSite=Lax",
  ];
  if (window.location.protocol === "https:") {
    attrs.push("Secure");
  }

  const value = `${CONSOLE_SESSION_HINT_COOKIE_NAME}=1; ${attrs.join("; ")}`;
  const domain = sharedCookieDomainForHostname(window.location.hostname);
  if (!domain) return [value];

  return [value, `${value}; Domain=${domain}`];
}
