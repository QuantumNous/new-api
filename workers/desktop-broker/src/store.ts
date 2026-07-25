import type { Env } from "./env";
import { nowSeconds, randomToken } from "./http";

export interface PendingConsent {
  state: string;
  user_id: string;
  connector: string;
  provider: string;
  redirect: string;
  app_state: string;
  access: string;
  flow: string;
  expires_at: number;
}

const STATE_TTL_SECONDS = 900;

export async function createState(
  env: Env,
  row: Omit<PendingConsent, "state" | "expires_at">,
): Promise<string> {
  const state = randomToken(24);
  await env.DB.prepare(
    `INSERT INTO oauth_states (state, user_id, connector, provider, redirect, app_state, access, flow, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      state,
      row.user_id,
      row.connector,
      row.provider,
      row.redirect,
      row.app_state,
      row.access,
      row.flow,
      nowSeconds() + STATE_TTL_SECONDS,
    )
    .run();
  return state;
}

/** Single use: a replayed callback must not be able to mint a second connection. Deleting and
 *  returning in one statement keeps that true for callbacks that arrive concurrently, which a
 *  SELECT followed by a DELETE would not. */
export async function consumeState(env: Env, state: string): Promise<PendingConsent | null> {
  if (!state) return null;
  const row = await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ? AND expires_at >= ? RETURNING *`)
    .bind(state, nowSeconds())
    .first<PendingConsent>();
  await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ? OR expires_at < ?`)
    .bind(state, nowSeconds())
    .run();
  return row ?? null;
}

export interface ConnectionRow {
  connection_id: string;
  user_id: string;
  connector: string;
  provider: string;
  status: string;
  account: string;
  account_id: string;
  tenant_metadata: string;
}

/** Re-consenting an account already connected reuses its connection_id, so the desktop's stored
 *  profile keeps working instead of orphaning a row per consent. */
export async function upsertConnection(
  env: Env,
  input: {
    user_id: string;
    connector: string;
    provider: string;
    account: string;
    account_id: string;
    tenant_metadata: Record<string, unknown>;
  },
): Promise<string> {
  const existing = await env.DB.prepare(
    `SELECT connection_id FROM connections WHERE user_id = ? AND connector = ? AND account_id = ?`,
  )
    .bind(input.user_id, input.connector, input.account_id)
    .first<{ connection_id: string }>();

  const now = nowSeconds();
  const metadata = JSON.stringify(input.tenant_metadata);
  if (existing) {
    await env.DB.prepare(
      `UPDATE connections SET status = 'connected', account = ?, tenant_metadata = ?, updated_at = ?
       WHERE connection_id = ?`,
    )
      .bind(input.account, metadata, now, existing.connection_id)
      .run();
    return existing.connection_id;
  }

  const connectionId = randomToken(16);
  await env.DB.prepare(
    `INSERT INTO connections
       (connection_id, user_id, connector, provider, status, account, account_id, tenant_metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?)`,
  )
    .bind(
      connectionId,
      input.user_id,
      input.connector,
      input.provider,
      input.account,
      input.account_id,
      metadata,
      now,
      now,
    )
    .run();
  return connectionId;
}

export async function listConnections(env: Env, userId: string): Promise<ConnectionRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM connections WHERE user_id = ? ORDER BY created_at`,
  )
    .bind(userId)
    .all<ConnectionRow>();
  return results ?? [];
}

/** Disconnecting has to drop the routing rows too: ownsGithubInstallation reads github_routes, so
 *  a connection left routed would keep minting installation tokens after the UI called it gone. */
export async function markDisconnected(env: Env, userId: string, connectionId: string): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE connections SET status = 'disconnected', updated_at = ? WHERE connection_id = ? AND user_id = ?`,
  )
    .bind(nowSeconds(), connectionId, userId)
    .run();
  if ((result.meta?.changes ?? 0) === 0) return false;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM github_routes WHERE connection_id = ? AND user_id = ?`).bind(connectionId, userId),
    env.DB.prepare(`DELETE FROM slack_routes WHERE connection_id = ? AND user_id = ?`).bind(connectionId, userId),
  ]);
  return true;
}

export async function addSlackRoute(env: Env, teamId: string, userId: string, connectionId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO slack_routes (team_id, user_id, connection_id, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(teamId, userId, connectionId, nowSeconds())
    .run();
}

export async function dropSlackRoute(env: Env, teamId: string, userId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM slack_routes WHERE team_id = ? AND user_id = ?`).bind(teamId, userId).run();
}

export async function addGithubRoute(
  env: Env,
  installationId: string,
  userId: string,
  connectionId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO github_routes (installation_id, user_id, connection_id, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(installationId, userId, connectionId, nowSeconds())
    .run();
}

export async function dropGithubRoute(env: Env, installationId: string, userId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM github_routes WHERE installation_id = ? AND user_id = ?`)
    .bind(installationId, userId)
    .run();
}

export async function ownsGithubInstallation(env: Env, userId: string, installationId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM github_routes WHERE installation_id = ? AND user_id = ?`,
  )
    .bind(installationId, userId)
    .first<{ ok: number }>();
  return !!row;
}
