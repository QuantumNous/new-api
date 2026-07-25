/** The broker answers the desktop sidecar, never a browser fetch, so no CORS headers. */
export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    badRequest("body must be JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) badRequest("body must be a JSON object");
  return body as Record<string, unknown>;
}

export function str(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export function required(body: Record<string, unknown>, key: string): string {
  const value = str(body, key);
  if (!value) badRequest(`${key} is required`);
  return value;
}

/** URL-safe random token, used for both `state` and connection ids. */
export function randomToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
