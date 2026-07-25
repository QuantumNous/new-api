import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import {
  accessToken,
  applySchema,
  installFetchStub,
  makeKey,
  onFetch,
  restoreFetch,
  serveJwks,
  stubIdToken,
  type TestKey,
} from "./helpers";
import { STUB } from "./stubs";

const LOOPBACK = "http://127.0.0.1:53119/oauth/callback";

let key: TestKey;
let auth: string;

beforeEach(async () => {
  await applySchema();
  installFetchStub();
  key = await makeKey();
  serveJwks(key);
  auth = `Bearer ${await accessToken(key)}`;
});

afterEach(restoreFetch);

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request(`https://broker.test${path}`, init), env);
}

function start(body: Record<string, unknown>, provider = "google"): Promise<Response> {
  return call(`/v1/oauth/${provider}/start`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function startedState(body: Record<string, unknown>, provider = "google"): Promise<string> {
  const resp = await start(body, provider);
  const { authorize_url } = (await resp.json()) as { authorize_url: string };
  return new URL(authorize_url).searchParams.get("state")!;
}

/** The desktop parses the callback page's hidden inputs; the tests read them the same way. */
function postedFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) {
    fields[match[1]] = match[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  return fields;
}

function formAction(html: string): string {
  return /<form id="deliver" method="POST" action="([^"]+)">/.exec(html)![1];
}

describe("consent start", () => {
  it("returns a provider consent URL and remembers the desktop's callback target", async () => {
    const resp = await start({ connector: "gmail", redirect: LOOPBACK, app_state: "csrf-1" });
    expect(resp.status).toBe(200);

    const { authorize_url } = (await resp.json()) as { authorize_url: string };
    const url = new URL(authorize_url);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://broker.test/v1/oauth/google/callback");
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/gmail.modify");
    // Without these Google issues no refresh token, and unattended renewal dies a week later.
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");

    const row = await env.DB.prepare(`SELECT * FROM oauth_states WHERE state = ?`)
      .bind(url.searchParams.get("state"))
      .first<{ user_id: string; redirect: string; app_state: string }>();
    expect(row).toMatchObject({ user_id: "42", redirect: LOOPBACK, app_state: "csrf-1" });
  });

  it("requires a signed-in caller", async () => {
    const resp = await call("/v1/oauth/google/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connector: "gmail", redirect: LOOPBACK, app_state: "csrf-1" }),
    });
    expect(resp.status).toBe(401);
  });

  // The callback form-POSTs live connector tokens to this address, so anything but the desktop's
  // own loopback listener is an exfiltration target chosen by the caller.
  it.each([
    "https://attacker.test/oauth/callback",
    "http://attacker.test/oauth/callback",
    "http://127.0.0.1:53119/steal",
    "http://127.0.0.1.attacker.test/oauth/callback",
  ])("refuses to deliver tokens to %s", async (redirect) => {
    const resp = await start({ connector: "gmail", redirect, app_state: "csrf-1" });
    expect(resp.status).toBe(400);
  });

  it("refuses a connector that does not belong to the provider", async () => {
    const resp = await start({ connector: "slack", redirect: LOOPBACK, app_state: "csrf-1" }, "google");
    expect(resp.status).toBe(400);
  });

  it("refuses a connector with no managed path at all", async () => {
    const resp = await start({ connector: "telegram", redirect: LOOPBACK, app_state: "csrf-1" }, "google");
    expect(resp.status).toBe(400);
  });

  it("reports an unconfigured provider instead of building a broken consent URL", async () => {
    const resp = await start({ connector: "notion", redirect: LOOPBACK, app_state: "csrf-1" }, "notion");
    expect(resp.status).toBe(501);
  });
});

describe("google callback", () => {
  function serveGoogleToken(overrides: Record<string, unknown> = {}): void {
    onFetch((request) =>
      request.url === "https://oauth2.googleapis.com/token"
        ? Response.json({
            access_token: STUB.googleAccess,
            refresh_token: STUB.googleRefresh,
            expires_in: 3599,
            scope: "https://www.googleapis.com/auth/gmail.modify",
            id_token: stubIdToken({ email: "rohit@you-box.com", sub: "google-sub-1" }),
            ...overrides,
          })
        : undefined,
    );
  }

  it("delivers the token payload to the desktop and records the connection", async () => {
    serveGoogleToken();
    const state = await startedState({ connector: "gmail", redirect: LOOPBACK, app_state: "csrf-1" });

    const resp = await call(`/v1/oauth/google/callback?code=auth-code&state=${state}`);
    expect(resp.status).toBe(200);
    const html = await resp.text();

    expect(formAction(html)).toBe(LOOPBACK);
    const fields = postedFields(html);
    expect(fields).toMatchObject({
      access_token: STUB.googleAccess,
      refresh_token: STUB.googleRefresh,
      provider: "google",
      connector: "gmail",
      account: "rohit@you-box.com",
      account_id: "google-sub-1",
      expires_in: "3599",
      // The desktop drops any callback whose app_state it did not hand out.
      app_state: "csrf-1",
    });
    expect(fields.connection_id).toBeTruthy();

    const row = await env.DB.prepare(`SELECT * FROM connections WHERE user_id = '42'`).first<{
      connector: string;
      account: string;
      status: string;
      tenant_metadata: string;
    }>();
    expect(row).toMatchObject({ connector: "gmail", account: "rohit@you-box.com", status: "connected" });
    // Connector credentials must never be persisted at the edge.
    expect(row!.tenant_metadata).not.toContain(STUB.googleAccess);
    expect(row!.tenant_metadata).not.toContain(STUB.googleRefresh);
  });

  it("consumes the state so a replayed callback cannot mint a second connection", async () => {
    serveGoogleToken();
    const state = await startedState({ connector: "gmail", redirect: LOOPBACK, app_state: "csrf-1" });

    expect((await call(`/v1/oauth/google/callback?code=auth-code&state=${state}`)).status).toBe(200);
    const replay = await call(`/v1/oauth/google/callback?code=auth-code&state=${state}`);
    expect(replay.status).toBe(400);
    expect(await replay.text()).toContain("expired or was already used");
  });

  it("rejects a callback bearing a state nobody issued", async () => {
    const resp = await call("/v1/oauth/google/callback?code=auth-code&state=made-up");
    expect(resp.status).toBe(400);
  });

  it("re-consenting the same mailbox updates the row instead of adding another", async () => {
    serveGoogleToken();
    for (const appState of ["csrf-1", "csrf-2"]) {
      const state = await startedState({ connector: "gmail", redirect: LOOPBACK, app_state: appState });
      await call(`/v1/oauth/google/callback?code=auth-code&state=${state}`);
    }
    const { results } = await env.DB.prepare(`SELECT connection_id FROM connections WHERE user_id = '42'`).all();
    expect(results).toHaveLength(1);
  });

  // A denied consent has to reach the desktop, or the app sits on a spinner until it restarts.
  it("hands a provider error back to the desktop with the app_state", async () => {
    const state = await startedState({ connector: "gmail", redirect: LOOPBACK, app_state: "csrf-1" });
    const resp = await call(`/v1/oauth/google/callback?error=access_denied&state=${state}`);
    expect(resp.status).toBe(200);

    const fields = postedFields(await resp.text());
    expect(fields).toMatchObject({ error: "access_denied", app_state: "csrf-1" });
    expect(fields.access_token).toBeUndefined();
  });

  it("reports a token exchange that the provider rejects", async () => {
    onFetch((request) =>
      request.url === "https://oauth2.googleapis.com/token"
        ? Response.json({ error: "invalid_grant", error_description: "code already redeemed" }, { status: 400 })
        : undefined,
    );
    const state = await startedState({ connector: "gmail", redirect: LOOPBACK, app_state: "csrf-1" });
    const resp = await call(`/v1/oauth/google/callback?code=stale&state=${state}`);

    expect(postedFields(await resp.text())).toMatchObject({
      error: "code already redeemed",
      app_state: "csrf-1",
    });
  });
});

describe("token refresh", () => {
  it("renews a Google token and keeps the existing refresh token when none is returned", async () => {
    onFetch((request) =>
      request.url === "https://oauth2.googleapis.com/token"
        ? Response.json({ access_token: STUB.googleAccessRenewed, expires_in: 3599 })
        : undefined,
    );
    const resp = await call("/v1/oauth/google/refresh", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: STUB.googleRefresh, connection_id: "c1", connector: "gmail" }),
    });

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as Record<string, unknown>;
    expect(body.access_token).toBe(STUB.googleAccessRenewed);
    expect(body.expires_in).toBe(3599);
    // Echoing an empty refresh_token would wipe the working one in the desktop's secret store.
    expect(body).not.toHaveProperty("refresh_token");
  });

  it("passes a rotated refresh token through", async () => {
    onFetch((request) =>
      request.url === "https://oauth2.googleapis.com/token"
        ? Response.json({ access_token: STUB.googleAccessRenewed, refresh_token: STUB.googleRefreshRotated, expires_in: 60 })
        : undefined,
    );
    const resp = await call("/v1/oauth/google/refresh", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: STUB.googleRefresh, connector: "gmail" }),
    });
    expect((await resp.json()) as Record<string, unknown>).toMatchObject({ refresh_token: STUB.googleRefreshRotated });
  });

  it("requires a signed-in caller", async () => {
    const resp = await call("/v1/oauth/google/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: STUB.googleRefresh }),
    });
    expect(resp.status).toBe(401);
  });
});
