// GitHub is a GitHub App, not a plain OAuth app. The desktop never holds a GitHub credential:
// the callback delivers installation routing metadata only, and every API call it makes uses an
// installation token minted here on demand (~1h life, memory-cached client side). That way a
// stolen local profile grants nothing, and revoking the installation on GitHub cuts access at
// the source.
import type { Env } from "./env";
import { HttpError, nowSeconds } from "./http";
import type { CallbackFields } from "./providers";

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new HttpError(501, "github app private key is not configured");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function appJwt(env: Env): Promise<string> {
  const appId = env.GITHUB_APP_ID;
  const pem = env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !pem) throw new HttpError(501, "github is not configured on this broker");
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    // PKCS#1 is what GitHub hands out and what WebCrypto refuses; failing loudly here beats a
    // cryptic DataError at import time.
    throw new HttpError(500, "github app key must be PKCS#8 (openssl pkcs8 -topk8 -nocrypt)");
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = nowSeconds();
  const encode = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));
  // 60s of backdating absorbs clock skew between the edge and GitHub; the app JWT caps at 10 min.
  const signingInput = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(signature))}`;
}

async function githubApi(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const resp = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "BoxAI-Desktop-Broker",
      authorization: `Bearer ${await appJwt(env)}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new HttpError(resp.status === 404 ? 404 : 502, (body as any)?.message ?? `GitHub call failed (${resp.status})`);
  }
  return body;
}

export interface InstallationToken {
  token: string;
  expires_at: string;
}

export async function mintInstallationToken(env: Env, installationId: string): Promise<InstallationToken> {
  const body = await githubApi(env, `/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: "POST",
  });
  return { token: String(body.token ?? ""), expires_at: String(body.expires_at ?? "") };
}

export interface InstallationInfo {
  installation_id: string;
  account_login: string;
  account_type: string;
  repo_selection: string;
}

export async function readInstallation(env: Env, installationId: string): Promise<InstallationInfo> {
  const body = await githubApi(env, `/app/installations/${encodeURIComponent(installationId)}`);
  return {
    installation_id: String(installationId),
    account_login: String(body.account?.login ?? ""),
    account_type: String(body.account?.type ?? ""),
    repo_selection: String(body.repository_selection ?? ""),
  };
}

/** GitHub authorization codes are single-use, so the callback exchanges once and both the identity
 *  and the installation lookups reuse the resulting user-to-server token. */
async function exchangeUserToken(env: Env, code: string, redirectUri: string): Promise<string> {
  const id = env.GITHUB_CLIENT_ID;
  const secret = env.GITHUB_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(501, "github is not configured on this broker");
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, code, redirect_uri: redirectUri }).toString(),
  });
  const token = (await tokenResp.json().catch(() => ({}))) as any;
  return String(token?.access_token ?? "");
}

async function userApi(path: string, userToken: string): Promise<any> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "BoxAI-Desktop-Broker",
      authorization: `Bearer ${userToken}`,
    },
  })
    .then((r) => r.json() as Promise<any>)
    .catch(() => ({}));
}

/** The login of the human who ran the flow. Used for @-mention routing. */
async function userLogin(userToken: string): Promise<string> {
  const user = await userApi("/user", userToken);
  return String(user?.login ?? "");
}

/** Installations of this App the authorizing user can actually reach. This is the only statement
 *  about installation ownership that comes from GitHub rather than from the request. */
async function userInstallations(env: Env, userToken: string): Promise<string[]> {
  const body = await userApi("/user/installations", userToken);
  return (body?.installations ?? [])
    .filter((inst: any) => String(inst?.app_id ?? "") === String(env.GITHUB_APP_ID ?? ""))
    .map((inst: any) => String(inst.id));
}

export interface GithubCallbackResult {
  fields: CallbackFields;
  installations: InstallationInfo[];
  githubLogin: string;
}

/** Resolves either GitHub flow into the routing metadata the desktop stores.
 *
 *  The state proves only that this browser started a flow, never that a consent happened at
 *  GitHub, and the App JWT can read every installation of the App. So `installation_id` off the
 *  query string is treated as a claim and confirmed against the installations the freshly
 *  authorized user can reach — otherwise anyone with an account could name a stranger's
 *  installation here and then mint tokens for it. This requires "Request user authorization
 *  (OAuth) during installation" on the GitHub App so the install redirect carries `code`. */
export async function resolveGithubCallback(
  env: Env,
  params: URLSearchParams,
  redirectUri: string,
): Promise<GithubCallbackResult> {
  const code = params.get("code") ?? "";
  if (!code) throw new HttpError(400, "GitHub did not return a user authorization code");
  const userToken = await exchangeUserToken(env, code, redirectUri);
  if (!userToken) throw new HttpError(401, "the GitHub authorization code could not be exchanged");

  const login = await userLogin(userToken);
  const authorized = await userInstallations(env, userToken);

  const direct = params.get("installation_id") ?? "";
  const ids = direct ? authorized.filter((id) => id === direct) : authorized;
  if (ids.length === 0) {
    if (direct) throw new HttpError(403, "this GitHub installation is not authorized for the account that consented");
    throw new HttpError(400, "no GitHub installation came back from the consent");
  }

  const installations: InstallationInfo[] = [];
  for (const id of ids) installations.push(await readInstallation(env, id));

  const primary = installations[0];
  return {
    fields: {
      provider: "github",
      // No token fields on purpose — see the note at the top of this file.
      installation_id: primary.installation_id,
      account_login: primary.account_login,
      account_type: primary.account_type,
      repo_selection: primary.repo_selection,
      github_login: login,
      account: primary.account_login,
      account_id: primary.installation_id,
    },
    installations,
    githubLogin: login,
  };
}
