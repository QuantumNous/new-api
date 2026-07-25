import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import {
  accessToken,
  applySchema,
  installFetchStub,
  installGithubAppKey,
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

function authed(path: string, body?: unknown): Promise<Response> {
  return call(path, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function startedState(connector: string, provider: string, flow = ""): Promise<string> {
  const resp = await authed(`/v1/oauth/${provider}/start`, {
    connector,
    redirect: LOOPBACK,
    app_state: "csrf-1",
    ...(flow ? { flow } : {}),
  });
  const { authorize_url } = (await resp.json()) as { authorize_url: string };
  return new URL(authorize_url).searchParams.get("state")!;
}

function postedFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) {
    fields[match[1]] = match[2].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  return fields;
}

describe("slack", () => {
  beforeEach(() => {
    onFetch((request) => {
      if (request.url === "https://slack.com/api/oauth.v2.access") {
        return Response.json({
          ok: true,
          access_token: STUB.slackBot,
          scope: "chat:write,channels:history",
          bot_user_id: "U-BOT",
          team: { id: "T111", name: "Acme" },
          authed_user: { id: "U-HUMAN" },
        });
      }
      if (request.url === "https://slack.com/api/auth.test") {
        return Response.json({ ok: true, url: "https://acme-hq.slack.com/" });
      }
      return undefined;
    });
  });

  it("delivers the workspace fields the desktop's relay mode needs", async () => {
    const state = await startedState("slack", "slack");
    const resp = await call(`/v1/oauth/slack/callback?code=slack-code&state=${state}`);
    expect(resp.status).toBe(200);

    expect(postedFields(await resp.text())).toMatchObject({
      connector: "slack",
      provider: "slack",
      access_token: STUB.slackBot,
      team_id: "T111",
      team_domain: "acme-hq",
      bot_user_id: "U-BOT",
      slack_user_id: "U-HUMAN",
      account: "Acme",
      app_state: "csrf-1",
    });
  });

  it("routes the workspace's inbound events to this user", async () => {
    const state = await startedState("slack", "slack");
    await call(`/v1/oauth/slack/callback?code=slack-code&state=${state}`);

    const route = await env.DB.prepare(`SELECT user_id FROM slack_routes WHERE team_id = 'T111'`).first<{
      user_id: string;
    }>();
    expect(route?.user_id).toBe("42");
  });

  it("stops routing a workspace the desktop uninstalled", async () => {
    const state = await startedState("slack", "slack");
    await call(`/v1/oauth/slack/callback?code=slack-code&state=${state}`);

    expect((await authed("/v1/relay/slack/uninstall", { team_id: "T111" })).status).toBe(200);
    const route = await env.DB.prepare(`SELECT user_id FROM slack_routes WHERE team_id = 'T111'`).first();
    expect(route).toBeNull();
  });

  it("surfaces a Slack-level failure rather than storing a half-connection", async () => {
    installFetchStub();
    serveJwks(key);
    onFetch((request) =>
      request.url === "https://slack.com/api/oauth.v2.access"
        ? Response.json({ ok: false, error: "invalid_code" })
        : undefined,
    );
    const state = await startedState("slack", "slack");
    const resp = await call(`/v1/oauth/slack/callback?code=stale&state=${state}`);

    expect(postedFields(await resp.text()).error).toContain("invalid_code");
    expect(await env.DB.prepare(`SELECT * FROM connections`).first()).toBeNull();
  });
});

describe("github", () => {
  // GitHub authorization codes are single-use; the stub enforces that so a second exchange fails
  // here the way it does in production.
  let spentCodes: Set<string>;

  beforeEach(async () => {
    await installGithubAppKey();
    spentCodes = new Set();
    onFetch(async (request) => {
      if (request.url === "https://api.github.com/app/installations/9001") {
        return Response.json({
          account: { login: "acme-inc", type: "Organization" },
          repository_selection: "selected",
        });
      }
      if (request.url === "https://github.com/login/oauth/access_token") {
        const code = new URLSearchParams(await request.text()).get("code") ?? "";
        if (spentCodes.has(code)) return Response.json({ error: "bad_verification_code" });
        spentCodes.add(code);
        return Response.json({ access_token: STUB.githubUser });
      }
      if (request.url === "https://api.github.com/user") {
        return Response.json({ login: "rohit" });
      }
      if (request.url === "https://api.github.com/user/installations") {
        return Response.json({ installations: [{ id: 9001, app_id: 12345 }] });
      }
      if (request.url === "https://api.github.com/app/installations/9001/access_tokens") {
        return Response.json({ token: STUB.githubInstallation, expires_at: "2026-01-01T00:00:00Z" });
      }
      return undefined;
    });
  });

  it("sends the App install page, not an OAuth consent screen", async () => {
    const resp = await authed("/v1/oauth/github/start", {
      connector: "github",
      redirect: LOOPBACK,
      app_state: "csrf-1",
    });
    const { authorize_url } = (await resp.json()) as { authorize_url: string };
    expect(authorize_url).toMatch(/^https:\/\/github\.com\/apps\/boxai-agent\/installations\/new\?state=/);
  });

  // github-relay-spec §4: the desktop holds routing metadata only and mints tokens on demand, so
  // a stolen local profile is worth nothing.
  it("delivers installation metadata and no credential at all", async () => {
    const state = await startedState("github", "github");
    const resp = await call(
      `/v1/oauth/github/callback?code=gh-code&installation_id=9001&setup_action=install&state=${state}`,
    );

    const fields = postedFields(await resp.text());
    expect(fields).toMatchObject({
      connector: "github",
      installation_id: "9001",
      account_login: "acme-inc",
      account_type: "Organization",
      repo_selection: "selected",
      app_state: "csrf-1",
    });
    expect(fields.access_token).toBeUndefined();
    expect(fields.refresh_token).toBeUndefined();
  });

  it("mints an installation token for an installation this user connected", async () => {
    const state = await startedState("github", "github");
    await call(`/v1/oauth/github/callback?code=gh-code&installation_id=9001&state=${state}`);

    const resp = await authed("/v1/github/token", { installation_id: "9001" });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ token: STUB.githubInstallation, expires_at: "2026-01-01T00:00:00Z" });
  });

  // Installation ids are guessable integers, so ownership comes from the routing table rather
  // than from the request.
  it("refuses to mint a token for somebody else's installation", async () => {
    const resp = await authed("/v1/github/token", { installation_id: "9001" });
    expect(resp.status).toBe(403);
  });

  // The App JWT can read every installation of the App, so a callback that trusted the query
  // string would hand any account a token for a stranger's org.
  it("refuses an installation the consenting user cannot reach", async () => {
    const state = await startedState("github", "github");
    const resp = await call(`/v1/oauth/github/callback?code=gh-code&installation_id=4242&state=${state}`);

    expect(postedFields(await resp.text()).error).toContain("not authorized");
    expect(await env.DB.prepare(`SELECT * FROM github_routes`).first()).toBeNull();
    expect((await authed("/v1/github/token", { installation_id: "4242" })).status).toBe(403);
  });

  // Without the user code the state alone would stand in for a consent that never happened.
  it("refuses a callback that carries no authorization code", async () => {
    const state = await startedState("github", "github");
    const resp = await call(`/v1/oauth/github/callback?installation_id=9001&setup_action=install&state=${state}`);

    expect(postedFields(await resp.text()).error).toContain("user authorization code");
    expect(await env.DB.prepare(`SELECT * FROM github_routes`).first()).toBeNull();
  });

  it("stops routing an installation the desktop disconnected", async () => {
    const state = await startedState("github", "github");
    await call(`/v1/oauth/github/callback?code=gh-code&installation_id=9001&state=${state}`);

    expect((await authed("/v1/relay/github/disconnect", { installation_id: "9001" })).status).toBe(200);
    expect((await authed("/v1/github/token", { installation_id: "9001" })).status).toBe(403);
  });

  // Disconnecting the connection has to revoke as thoroughly as disconnecting the route, or the
  // UI reports an access level that the broker still honours.
  it("stops minting tokens once the connection itself is disconnected", async () => {
    const state = await startedState("github", "github");
    const fields = postedFields(
      await (await call(`/v1/oauth/github/callback?code=gh-code&installation_id=9001&state=${state}`)).text(),
    );

    expect((await authed(`/v1/connections/${fields.connection_id}/disconnect`)).status).toBe(200);
    expect((await authed("/v1/github/token", { installation_id: "9001" })).status).toBe(403);
  });

  // github.ts used to exchange the code once for the login and again for the installation list;
  // since GitHub codes are single-use the second call came back empty and the flow always failed.
  it("links a teammate to an existing installation without installation_id", async () => {
    const state = await startedState("github", "github", "authorize");
    const resp = await call(`/v1/oauth/github/callback?code=gh-code&state=${state}`);

    expect(postedFields(await resp.text())).toMatchObject({ installation_id: "9001", github_login: "rohit" });
    expect(spentCodes.size).toBe(1);
  });
});

describe("connections", () => {
  async function connectGmail(): Promise<string> {
    onFetch((request) =>
      request.url === "https://oauth2.googleapis.com/token"
        ? Response.json({
            access_token: STUB.googleAccess,
            refresh_token: STUB.googleRefresh,
            expires_in: 3599,
            id_token: stubIdToken({ email: "rohit@you-box.com", sub: "google-sub-1" }),
          })
        : undefined,
    );
    const state = await startedState("gmail", "google");
    const resp = await call(`/v1/oauth/google/callback?code=auth-code&state=${state}`);
    return postedFields(await resp.text()).connection_id;
  }

  it("lists this user's connections with their routing metadata", async () => {
    await connectGmail();
    const resp = await call("/v1/connections", { headers: { authorization: auth } });
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as { connections: Record<string, unknown>[] };
    expect(body.connections).toHaveLength(1);
    expect(body.connections[0]).toMatchObject({
      connector: "gmail",
      status: "connected",
      tenant_metadata: { email: "rohit@you-box.com" },
    });
  });

  it("never lists another account's connections", async () => {
    await connectGmail();
    const other = `Bearer ${await accessToken(key, { sub: "99" })}`;
    const resp = await call("/v1/connections", { headers: { authorization: other } });
    expect((await resp.json()) as { connections: unknown[] }).toEqual({ connections: [] });
  });

  it("flips a connection to disconnected", async () => {
    const connectionId = await connectGmail();
    expect((await authed(`/v1/connections/${connectionId}/disconnect`)).status).toBe(200);

    const resp = await call("/v1/connections", { headers: { authorization: auth } });
    const body = (await resp.json()) as { connections: { status: string }[] };
    expect(body.connections[0].status).toBe("disconnected");
  });

  it("will not let one account disconnect another's connection", async () => {
    const connectionId = await connectGmail();
    const other = `Bearer ${await accessToken(key, { sub: "99" })}`;
    const resp = await call(`/v1/connections/${connectionId}/disconnect`, {
      method: "POST",
      headers: { authorization: other },
    });
    expect(await resp.json()).toEqual({ ok: false });

    const still = await call("/v1/connections", { headers: { authorization: auth } });
    const body = (await still.json()) as { connections: { status: string }[] };
    expect(body.connections[0].status).toBe("connected");
  });
});
