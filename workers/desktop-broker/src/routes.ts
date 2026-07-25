import { requireSession, type Session } from "./auth";
import { autoPostPage, errorPage, isLoopbackRedirect } from "./callbackPage";
import type { Env } from "./env";
import { mintInstallationToken, resolveGithubCallback } from "./github";
import { HttpError, badRequest, json, readJson, required, str } from "./http";
import { PROVIDER_FOR_CONNECTOR, getProvider, type CallbackFields } from "./providers";
import {
  addGithubRoute,
  addSlackRoute,
  consumeState,
  createState,
  dropGithubRoute,
  dropSlackRoute,
  listConnections,
  markDisconnected,
  ownsGithubInstallation,
  upsertConnection,
} from "./store";

function callbackUri(env: Env, provider: string): string {
  return `${env.BROKER_BASE_URL.replace(/\/+$/, "")}/v1/oauth/${provider}/callback`;
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  return json({ user: { email: session.email, user_id: session.userId } });
}

export async function handleStart(request: Request, env: Env, provider: string): Promise<Response> {
  const session = await requireSession(request, env);
  const body = await readJson(request);

  const connector = required(body, "connector");
  const redirect = required(body, "redirect");
  const appState = required(body, "app_state");

  // The connector decides the provider; taking it from the URL alone would let a caller consent
  // Gmail scopes under a connector the desktop then stores as something else.
  const expected = PROVIDER_FOR_CONNECTOR[connector];
  if (!expected) badRequest(`${connector} has no managed OAuth path`);
  if (expected !== provider) badRequest(`${connector} does not connect through ${provider}`);
  // Tokens are form-POSTed to this address. Anything but the desktop's own loopback listener
  // would be an exfiltration target chosen by whoever called start.
  if (!isLoopbackRedirect(redirect)) badRequest("redirect must be a loopback /oauth/callback URL");

  const flow = str(body, "flow");
  const state = await createState(env, {
    user_id: session.userId,
    connector,
    provider,
    redirect,
    app_state: appState,
    access: str(body, "access"),
    flow,
  });

  const authorizeUrl = getProvider(provider).authorizeUrl(env, {
    state,
    connector,
    access: str(body, "access"),
    flow,
    redirectUri: callbackUri(env, provider),
  });
  return json({ authorize_url: authorizeUrl });
}

export async function handleCallback(request: Request, env: Env, provider: string): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const pending = await consumeState(env, params.get("state") ?? "");
  if (!pending) {
    // Without the state row there is no redirect to send the failure to, and no way to know the
    // consent was ours; the browser gets a plain page.
    return errorPage(null, "this connection request expired or was already used");
  }
  if (pending.provider !== provider) return errorPage(pending.redirect, "provider mismatch", pending.app_state);

  const providerError = params.get("error");
  if (providerError) {
    return errorPage(pending.redirect, params.get("error_description") || providerError, pending.app_state);
  }

  try {
    const redirectUri = callbackUri(env, provider);
    let fields: CallbackFields;
    let tenantMetadata: Record<string, unknown>;
    let accountId: string;
    let account: string;

    if (provider === "github") {
      const result = await resolveGithubCallback(env, params, redirectUri);
      fields = result.fields;
      tenantMetadata = {
        github_login: result.githubLogin,
        installations: result.installations,
        // Pre-restore-era desktops read the primary installation off the row itself.
        installation_id: result.installations[0]?.installation_id ?? "",
        account_login: result.installations[0]?.account_login ?? "",
      };
      accountId = result.installations[0]?.installation_id ?? "";
      account = result.installations[0]?.account_login ?? "";
    } else {
      const result = await getProvider(provider).exchange(env, {
        params,
        connector: pending.connector,
        flow: pending.flow,
        redirectUri,
      });
      fields = result.fields;
      tenantMetadata = result.tenantMetadata;
      accountId = fields.account_id ?? "";
      account = fields.account ?? "";
    }

    const connectionId = await upsertConnection(env, {
      user_id: pending.user_id,
      connector: pending.connector,
      provider,
      account,
      account_id: accountId,
      tenant_metadata: tenantMetadata,
    });

    // Relay routing rows: inbound Slack events and GitHub webhooks are addressed to a workspace
    // or an installation and have to find their way back to this user's desktop.
    if (provider === "slack" && fields.team_id) {
      await addSlackRoute(env, fields.team_id, pending.user_id, connectionId);
    }
    if (provider === "github") {
      for (const installation of (tenantMetadata.installations as { installation_id: string }[]) ?? []) {
        await addGithubRoute(env, installation.installation_id, pending.user_id, connectionId);
      }
    }

    return autoPostPage(pending.redirect, {
      ...fields,
      connector: pending.connector,
      connection_id: connectionId,
      app_state: pending.app_state,
    });
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "the connection could not be completed";
    return errorPage(pending.redirect, message, pending.app_state);
  }
}

export async function handleRefresh(request: Request, env: Env, provider: string): Promise<Response> {
  await requireSession(request, env);
  const body = await readJson(request);
  const refreshToken = required(body, "refresh_token");

  const refresh = getProvider(provider).refresh;
  if (!refresh) badRequest(`${provider} tokens do not expire`);

  const fields = await refresh(env, refreshToken);
  return json({
    access_token: fields.access_token ?? "",
    expires_in: Number(fields.expires_in ?? 3600),
    ...(fields.refresh_token ? { refresh_token: fields.refresh_token } : {}),
    ...(fields.scope ? { scope: fields.scope } : {}),
  });
}

export async function handleGithubToken(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  const body = await readJson(request);
  const installationId = required(body, "installation_id");

  // The installation id is a public-ish integer, so ownership is checked against this user's
  // routing rows rather than trusted from the request.
  if (!(await ownsGithubInstallation(env, session.userId, installationId))) {
    throw new HttpError(403, "this installation is not connected to your account");
  }
  const minted = await mintInstallationToken(env, installationId);
  return json(minted);
}

export async function handleConnections(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  const rows = await listConnections(env, session.userId);
  return json({
    connections: rows.map((row) => ({
      connection_id: row.connection_id,
      connector: row.connector,
      status: row.status,
      account: row.account,
      tenant_metadata: safeJson(row.tenant_metadata),
    })),
  });
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function handleDisconnect(request: Request, env: Env, connectionId: string): Promise<Response> {
  const session = await requireSession(request, env);
  const changed = await markDisconnected(env, session.userId, connectionId);
  return json({ ok: changed });
}

export async function handleGithubDisconnect(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  const body = await readJson(request);
  await dropGithubRoute(env, required(body, "installation_id"), session.userId);
  return json({ ok: true });
}

export async function handleSlackUninstall(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  const body = await readJson(request);
  await dropSlackRoute(env, required(body, "team_id"), session.userId);
  return json({ ok: true });
}

export type { Session };
