// Desktop sessions are RS256 JWTs minted by BoxAI's PKCE authorization flow. Signature checks
// reject forged tokens locally; the subsequent hub status check makes user/session/relay-token
// revocation effective immediately rather than waiting for the access JWT to expire.
import type { Env } from "./env";
import { HttpError } from "./http";

export interface Session {
  userId: string;
  email: string;
  username: string;
}

interface Jwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
}

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

const JWKS_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CachedKeys>();

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeSegment(segment: string): Record<string, unknown> {
  const text = new TextDecoder().decode(b64urlToBytes(segment));
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(401, "malformed token");
  return parsed as Record<string, unknown>;
}

async function loadKeys(env: Env, force: boolean): Promise<Map<string, CryptoKey>> {
  const url = env.HUB_BASE_URL.replace(/\/+$/, "") + "/.well-known/jwks.json";
  const cached = cache.get(url);
  if (!force && cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;

  const resp = await fetch(url, { headers: { accept: "application/json" } });
  if (!resp.ok) {
    // Serving stale keys beats signing everyone out because the hub blipped.
    if (cached) return cached.keys;
    throw new HttpError(503, "signing keys unavailable");
  }
  let payload: { keys?: Jwk[] };
  try {
    payload = (await resp.json()) as { keys?: Jwk[] };
  } catch {
    if (cached) return cached.keys;
    throw new HttpError(503, "signing keys unreadable");
  }

  const keys = new Map<string, CryptoKey>();
  for (const jwk of payload.keys ?? []) {
    if (jwk.kty !== "RSA" || !jwk.kid || !jwk.n || !jwk.e) continue;
    keys.set(
      jwk.kid,
      await crypto.subtle.importKey(
        "jwk",
        { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  if (keys.size === 0) {
    if (cached) return cached.keys;
    throw new HttpError(503, "signing keys unavailable");
  }
  cache.set(url, { keys, fetchedAt: Date.now() });
  return keys;
}

/** Test seam: JWKS lives in module state, which outlives a single test. */
export function resetJwksCache(): void {
  cache.clear();
}

export async function verifyToken(env: Env, token: string): Promise<Session> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "malformed token");
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = decodeSegment(rawHeader);
  if (header.alg !== "RS256") throw new HttpError(401, "unsupported token algorithm");
  const kid = typeof header.kid === "string" ? header.kid : "";

  // A rotated key is the one case worth a second JWKS fetch: unknown kid, refetch once.
  let keys = await loadKeys(env, false);
  let key = kid ? keys.get(kid) : [...keys.values()][0];
  if (!key) {
    keys = await loadKeys(env, true);
    key = kid ? keys.get(kid) : [...keys.values()][0];
  }
  if (!key) throw new HttpError(401, "unknown signing key");

  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(rawSignature), signed);
  if (!ok) throw new HttpError(401, "bad token signature");

  const claims = decodeSegment(rawPayload);
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new HttpError(401, "token expired");
  if (claims.iss !== env.JWT_ISSUER) throw new HttpError(401, "wrong token issuer");

  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(env.JWT_AUDIENCE)) throw new HttpError(401, "wrong token audience");
  // Refresh tokens verify identically; only the access half may spend broker endpoints.
  if (claims.typ !== "access") throw new HttpError(401, "not an access token");

  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const sessionId = typeof claims.sid === "string" ? claims.sid : "";
  const relayTokenId = typeof claims.tid === "number" ? claims.tid : 0;
  if (!userId || !sessionId || relayTokenId <= 0) throw new HttpError(401, "token is not a desktop session");

  const statusUrl = env.HUB_BASE_URL.replace(/\/+$/, "") + "/api/desktop/session-status";
  let status: Response;
  try {
    status = await fetch(statusUrl, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  } catch {
    throw new HttpError(503, "session status unavailable");
  }
  if (status.status === 401 || status.status === 403) throw new HttpError(401, "desktop session is inactive");
  if (!status.ok) throw new HttpError(503, "session status unavailable");
  const live = (await status.json()) as { active?: boolean; user_id?: number; session_id?: string };
  if (!live.active || String(live.user_id ?? "") !== userId || live.session_id !== sessionId) {
    throw new HttpError(401, "desktop session is inactive");
  }
  return {
    userId,
    email: typeof claims.email === "string" ? claims.email : "",
    username: typeof claims.username === "string" ? claims.username : "",
  };
}

export async function requireSession(request: Request, env: Env): Promise<Session> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) throw new HttpError(401, "missing bearer token");
  return verifyToken(env, match[1].trim());
}
