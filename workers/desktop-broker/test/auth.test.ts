import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import {
  accessToken,
  applySchema,
  installFetchStub,
  makeKey,
  restoreFetch,
  serveJwks,
  setSessionActive,
  signToken,
  type TestKey,
} from "./helpers";


async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request(`https://broker.test${path}`, init), env);
}

let key: TestKey;

beforeEach(async () => {
  await applySchema();
  installFetchStub();
  key = await makeKey();
  serveJwks(key);
});

afterEach(restoreFetch);

describe("session verification", () => {
  it("identifies the caller from a hub-signed access token", async () => {
    const resp = await call("/v1/me", { headers: { authorization: `Bearer ${await accessToken(key)}` } });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ user: { email: "rohit@you-box.com", user_id: "42" } });
  });

  it("refuses an unauthenticated call", async () => {
    expect((await call("/v1/me")).status).toBe(401);
  });

  it("rejects an otherwise valid token after its desktop session is revoked", async () => {
    setSessionActive(false);
    const resp = await call("/v1/me", { headers: { authorization: `Bearer ${await accessToken(key)}` } });
    expect(resp.status).toBe(401);
  });

  // Each of these is a way in for someone holding a token that is not a live desktop session for
  // this deployment.
  it.each([
    ["expired", { exp: Math.floor(Date.now() / 1000) - 10 }],
    ["issued for another deployment", { iss: "https://evil.test" }],
    ["issued for another audience", { aud: "https://hub.test/other" }],
    ["a refresh token", { typ: "refresh" }],
    ["subject-less", { sub: "" }],
    ["session-less", { sid: "" }],
    ["relay-token-less", { tid: 0 }],
  ])("rejects a token that is %s", async (_label, overrides) => {
    const resp = await call("/v1/me", {
      headers: { authorization: `Bearer ${await accessToken(key, overrides)}` },
    });
    expect(resp.status).toBe(401);
  });

  it("rejects a token signed by a key the hub does not publish", async () => {
    const attacker = await makeKey("test-key"); // same kid, different key material
    const resp = await call("/v1/me", {
      headers: { authorization: `Bearer ${await accessToken(attacker)}` },
    });
    expect(resp.status).toBe(401);
  });

  it("rejects alg=none, signature stripped", async () => {
    const claims = {
      iss: "https://hub.test",
      aud: "https://hub.test/desktop",
      sub: "42",
      typ: "access",
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const encode = (v: unknown) =>
      btoa(JSON.stringify(v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const forged = `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
    const resp = await call("/v1/me", { headers: { authorization: `Bearer ${forged}` } });
    expect(resp.status).toBe(401);
  });

  it("picks up a rotated signing key without waiting for the cache to expire", async () => {
    // Warm the cache with the old key, then have the hub publish a new one.
    await call("/v1/me", { headers: { authorization: `Bearer ${await accessToken(key)}` } });
    const rotated = await makeKey("rotated-key");
    serveJwks(rotated);

    const resp = await call("/v1/me", {
      headers: { authorization: `Bearer ${await signToken(rotated, {
        iss: "https://hub.test",
        aud: "https://hub.test/desktop",
        sub: "42",
        email: "rohit@you-box.com",
        typ: "access",
        sid: "desktop-session-1",
        tid: 7,
        exp: Math.floor(Date.now() / 1000) + 600,
      })}` },
    });
    expect(resp.status).toBe(200);
  });
});
