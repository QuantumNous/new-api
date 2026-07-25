// One entry per OAuth provider behind the managed-connect button. A provider owns three things:
// which consent URL to send the browser to, how to turn the returned code into the fields the
// desktop expects, and how to renew a token later. Scopes are decided here and never sent by the
// desktop, so tightening them ships without a client release.
import type { Env } from "./env";
import { HttpError } from "./http";

/** The form-POST payload the callback page delivers to the desktop's loopback listener. */
export interface CallbackFields {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  provider: string;
  account?: string;
  account_id?: string;
  expires_in?: string;
  [extra: string]: string | undefined;
}

export interface ExchangeResult {
  fields: CallbackFields;
  /** Persisted so a fresh install can be told which workspaces/installations exist. */
  tenantMetadata: Record<string, unknown>;
}

export interface StartContext {
  state: string;
  connector: string;
  access: string;
  flow: string;
  redirectUri: string;
}

export interface CallbackContext {
  params: URLSearchParams;
  connector: string;
  flow: string;
  redirectUri: string;
}

export interface Provider {
  authorizeUrl(env: Env, ctx: StartContext): string;
  exchange(env: Env, ctx: CallbackContext): Promise<ExchangeResult>;
  refresh?(env: Env, refreshToken: string): Promise<CallbackFields>;
}

function credentials(env: Env, provider: string): { id: string; secret: string } {
  const id = (env as unknown as Record<string, string | undefined>)[`${provider.toUpperCase()}_CLIENT_ID`];
  const secret = (env as unknown as Record<string, string | undefined>)[`${provider.toUpperCase()}_CLIENT_SECRET`];
  if (!id || !secret) throw new HttpError(501, `${provider} is not configured on this broker`);
  return { id, secret };
}

async function postForm(url: string, body: Record<string, string>, headers: HeadersInit = {}): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...headers },
    body: new URLSearchParams(body).toString(),
  });
  const text = await resp.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, `token endpoint returned non-JSON (${resp.status})`);
  }
  if (!resp.ok) throw new HttpError(502, parsed?.error_description || parsed?.error || `token exchange failed (${resp.status})`);
  return parsed;
}

/** The identity claims inside an id_token arrived over TLS straight from the token endpoint, so
 *  they are read, not re-verified. */
function idTokenClaims(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1];
  if (!payload) return {};
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const GOOGLE_SCOPES: Record<string, string[]> = {
  gmail: ["https://www.googleapis.com/auth/gmail.modify"],
  google_calendar: ["https://www.googleapis.com/auth/calendar"],
  google_drive: ["https://www.googleapis.com/auth/drive"],
};

const google: Provider = {
  authorizeUrl(env, ctx) {
    const { id } = credentials(env, "google");
    const scopes = GOOGLE_SCOPES[ctx.connector];
    if (!scopes) throw new HttpError(400, `${ctx.connector} has no Google scope set`);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", ctx.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", ["openid", "email", ...scopes].join(" "));
    // Google only returns a refresh token on the first consent unless it is asked for one
    // explicitly, and the desktop cannot re-run consent unattended at 3am.
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", ctx.state);
    return url.toString();
  },

  async exchange(env, ctx) {
    const { id, secret } = credentials(env, "google");
    const code = ctx.params.get("code") ?? "";
    if (!code) throw new HttpError(400, "missing authorization code");
    const token = await postForm("https://oauth2.googleapis.com/token", {
      client_id: id,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: ctx.redirectUri,
    });
    const claims = idTokenClaims(String(token.id_token ?? ""));
    const email = String(claims.email ?? "");
    return {
      fields: {
        provider: "google",
        access_token: String(token.access_token ?? ""),
        refresh_token: String(token.refresh_token ?? ""),
        scope: String(token.scope ?? ""),
        account: email,
        account_id: String(claims.sub ?? email),
        expires_in: token.expires_in ? String(token.expires_in) : undefined,
      },
      tenantMetadata: { email, sub: String(claims.sub ?? "") },
    };
  },

  async refresh(env, refreshToken) {
    const { id, secret } = credentials(env, "google");
    const token = await postForm("https://oauth2.googleapis.com/token", {
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    return {
      provider: "google",
      access_token: String(token.access_token ?? ""),
      // Google keeps the original refresh token; echoing an empty one would wipe it locally.
      refresh_token: token.refresh_token ? String(token.refresh_token) : undefined,
      scope: String(token.scope ?? ""),
      expires_in: token.expires_in ? String(token.expires_in) : undefined,
    };
  },
};

const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:read",
  "chat:write",
  "files:read",
  "groups:history",
  "groups:read",
  "im:history",
  "im:read",
  "im:write",
  "reactions:write",
  "team:read",
  "users:read",
];

const slack: Provider = {
  authorizeUrl(env, ctx) {
    const { id } = credentials(env, "slack");
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", id);
    url.searchParams.set("scope", SLACK_BOT_SCOPES.join(","));
    url.searchParams.set("redirect_uri", ctx.redirectUri);
    url.searchParams.set("state", ctx.state);
    return url.toString();
  },

  async exchange(env, ctx) {
    const { id, secret } = credentials(env, "slack");
    const code = ctx.params.get("code") ?? "";
    if (!code) throw new HttpError(400, "missing authorization code");
    const token = await postForm("https://slack.com/api/oauth.v2.access", {
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: ctx.redirectUri,
    });
    if (!token.ok) throw new HttpError(502, `Slack rejected the code: ${token.error ?? "unknown"}`);

    const botToken = String(token.access_token ?? "");
    const teamId = String(token.team?.id ?? "");
    const teamName = String(token.team?.name ?? "");
    // oauth.v2.access does not carry the workspace domain, and the desktop shows it next to the
    // workspace name; auth.test returns it without needing an extra scope.
    let teamDomain = "";
    try {
      const authTest = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { authorization: `Bearer ${botToken}` },
      }).then((r) => r.json() as Promise<any>);
      if (authTest?.ok && typeof authTest.url === "string") teamDomain = new URL(authTest.url).hostname.split(".")[0];
    } catch {
      /* cosmetic only */
    }

    return {
      fields: {
        provider: "slack",
        // Slack bot tokens do not expire unless token rotation is switched on for the app.
        access_token: botToken,
        scope: String(token.scope ?? ""),
        account: teamName,
        account_id: teamId,
        team_id: teamId,
        team_domain: teamDomain,
        bot_user_id: String(token.bot_user_id ?? ""),
        slack_user_id: String(token.authed_user?.id ?? ""),
      },
      tenantMetadata: { team_id: teamId, team_name: teamName, team_domain: teamDomain },
    };
  },
};

const notion: Provider = {
  authorizeUrl(env, ctx) {
    const { id } = credentials(env, "notion");
    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.searchParams.set("client_id", id);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("redirect_uri", ctx.redirectUri);
    url.searchParams.set("state", ctx.state);
    return url.toString();
  },

  async exchange(env, ctx) {
    const { id, secret } = credentials(env, "notion");
    const code = ctx.params.get("code") ?? "";
    if (!code) throw new HttpError(400, "missing authorization code");
    const resp = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        "content-type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: ctx.redirectUri }),
    });
    const token = (await resp.json()) as any;
    if (!resp.ok) throw new HttpError(502, token?.error ?? `Notion token exchange failed (${resp.status})`);

    const workspaceId = String(token.workspace_id ?? "");
    const workspaceName = String(token.workspace_name ?? "");
    return {
      fields: {
        provider: "notion",
        access_token: String(token.access_token ?? ""), // non-expiring
        account: workspaceName,
        account_id: workspaceId,
        bot_id: String(token.bot_id ?? ""),
      },
      tenantMetadata: { workspace_id: workspaceId, workspace_name: workspaceName },
    };
  },
};

// GitHub is the odd one out: the desktop never receives a GitHub token from the callback. It gets
// installation routing metadata, and mints short-lived installation tokens on demand through
// POST /v1/github/token. See github.ts.
const github: Provider = {
  authorizeUrl(env, ctx) {
    if (ctx.flow === "authorize") {
      // Linking a teammate to an installation somebody else already made.
      const { id } = credentials(env, "github");
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", id);
      url.searchParams.set("redirect_uri", ctx.redirectUri);
      url.searchParams.set("state", ctx.state);
      return url.toString();
    }
    const slug = env.GITHUB_APP_SLUG;
    if (!slug) throw new HttpError(501, "github is not configured on this broker");
    const url = new URL(`https://github.com/apps/${slug}/installations/new`);
    url.searchParams.set("state", ctx.state);
    return url.toString();
  },

  async exchange() {
    // Both GitHub flows need App-JWT calls and installation lookups, which live in github.ts;
    // the callback route dispatches there before reaching this method.
    throw new HttpError(500, "github callbacks are handled by the installation flow");
  },
};

const PROVIDERS: Record<string, Provider> = { google, slack, notion, github };

export function getProvider(name: string): Provider {
  const provider = PROVIDERS[name];
  if (!provider) throw new HttpError(404, `unknown provider ${name}`);
  return provider;
}

/** connector id (desktop-side descriptor name) -> provider. Mirrors PROVIDER_FOR_CONNECTOR in
 *  the desktop's cloud.py; a mismatch would let a connector consent under the wrong app. */
export const PROVIDER_FOR_CONNECTOR: Record<string, string> = {
  gmail: "google",
  google_calendar: "google",
  google_drive: "google",
  slack: "slack",
  notion: "notion",
  github: "github",
};
