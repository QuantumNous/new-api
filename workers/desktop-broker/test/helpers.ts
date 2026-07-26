import { env } from "cloudflare:test";
import { resetJwksCache } from "../src/auth";
// workerd has no filesystem; vite inlines the schema at build time instead.
import schemaSql from "../schema.sql?raw";

/** A signing key pair standing in for the hub's, so tests exercise real RS256 verification. */
export interface TestKey {
  privateKey: CryptoKey;
  jwks: { keys: unknown[] };
  kid: string;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const encodeJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

export async function makeKey(kid = "test-key"): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return {
    privateKey: pair.privateKey,
    kid,
    jwks: { keys: [{ kty: "RSA", use: "sig", alg: "RS256", kid, n: jwk.n, e: jwk.e }] },
  };
}

export async function signToken(
  key: TestKey,
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {},
): Promise<string> {
  const signingInput = `${encodeJson({ alg: "RS256", typ: "JWT", kid: key.kid, ...header })}.${encodeJson(claims)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(signature))}`;
}

export async function accessToken(key: TestKey, overrides: Record<string, unknown> = {}): Promise<string> {
  return signToken(key, {
    iss: "https://hub.test",
    aud: "https://hub.test/desktop",
    sub: "42",
    email: "rohit@you-box.com",
    username: "rohit",
    typ: "access",
    sid: "desktop-session-1",
    tid: 7,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  });
}

type Responder = (request: Request) => Response | undefined | Promise<Response | undefined>;

const responders: Responder[] = [];
const realFetch = globalThis.fetch;

/** Outbound calls (JWKS, provider token endpoints) are answered from the test, so a suite run
 *  never reaches Google or GitHub. */
export function onFetch(responder: Responder): void {
  responders.push(responder);
}

export function installFetchStub(): void {
  responders.length = 0;
  published = null;
  sessionActive = true;
  resetJwksCache();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    for (const responder of responders) {
      const response = await responder(request.clone());
      if (response) return response;
    }
    throw new Error(`unexpected outbound fetch: ${request.method} ${request.url}`);
  }) as typeof fetch;
}

export function restoreFetch(): void {
  globalThis.fetch = realFetch;
  responders.length = 0;
}

let published: TestKey | null = null;
let sessionActive = true;

export function setSessionActive(active: boolean): void {
  sessionActive = active;
}

/** Replaces what the hub publishes, so calling it again models a key rotation. */
export function serveJwks(key: TestKey): void {
  const first = published === null;
  published = key;
  if (!first) return;
  onFetch((request) =>
    request.url === "https://hub.test/.well-known/jwks.json" && published
      ? new Response(JSON.stringify(published.jwks), { headers: { "content-type": "application/json" } })
      : undefined,
  );
  onFetch((request) =>
    request.url === "https://hub.test/api/desktop/session-status"
      ? sessionActive
        ? (() => {
            const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
            const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
              sub: string;
              sid: string;
            };
            return new Response(JSON.stringify({ active: true, user_id: Number(payload.sub), session_id: payload.sid }), {
              headers: { "content-type": "application/json" },
            });
          })()
        : new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 })
      : undefined,
  );
}

// Storage is isolated per test, so the schema is (re)applied for each one rather than memoised.
export async function applySchema(): Promise<void> {
  const statements = schemaSql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
}

/** A real PKCS#8 RSA key so the GitHub App JWT is actually signed in tests, not stubbed out. */
export async function installGithubAppKey(): Promise<void> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const body = btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n");
  const mutable = env as unknown as Record<string, string>;
  mutable.GITHUB_APP_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  mutable.GITHUB_CLIENT_ID = "github-client";
  mutable.GITHUB_CLIENT_SECRET = "github-secret";
}

/** Google returns identity inside an id_token; tests only need its claims, not a signature. */
export function stubIdToken(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `stub-header.${payload}.stub-signature`;
}
