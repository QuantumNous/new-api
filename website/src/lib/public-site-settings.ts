import { APP_CONSOLE_ORIGIN } from "./origins";

export const DOCS_LINK_REVALIDATE_SECONDS = 60;
export const DOCS_LINK_TIMEOUT_MS = 3000;

type StatusPayload = {
  success?: unknown;
  data?: {
    docs_link?: unknown;
    google_client_id?: unknown;
    google_oauth?: unknown;
  } | null;
};

export type PublicSiteSettings = {
  docsUrl: string | null;
  googleOneTap: {
    clientId: string | null;
    enabled: boolean;
  };
};

export function normalizeDocsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function getDocsUrl(): Promise<string | null> {
  return (await getPublicSiteSettings()).docsUrl;
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const response = await fetch(new URL("/api/status", APP_CONSOLE_ORIGIN), {
      headers: { accept: "application/json" },
      next: { revalidate: DOCS_LINK_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(DOCS_LINK_TIMEOUT_MS),
    });
    if (!response.ok) return emptyPublicSiteSettings();

    const payload = (await response.json()) as StatusPayload;
    if (
      payload.success !== true ||
      !payload.data ||
      typeof payload.data !== "object"
    ) {
      return emptyPublicSiteSettings();
    }
    const googleClientId = normalizeGoogleClientId(payload.data.google_client_id);
    return {
      docsUrl: normalizeDocsUrl(payload.data.docs_link),
      googleOneTap: {
        clientId: googleClientId,
        enabled: payload.data.google_oauth === true && googleClientId !== null,
      },
    };
  } catch {
    return emptyPublicSiteSettings();
  }
}

function normalizeGoogleClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyPublicSiteSettings(): PublicSiteSettings {
  return {
    docsUrl: null,
    googleOneTap: {
      clientId: null,
      enabled: false,
    },
  };
}
