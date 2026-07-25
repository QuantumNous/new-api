-- BoxAI desktop connector broker.
--
-- Deliberately holds NO connector credentials: access/refresh tokens are form-POSTed straight
-- to the desktop's loopback listener and live in the user's local secret store. What stays here
-- is the routing and display metadata the desktop cannot reconstruct on a fresh install
-- (which workspace/installation belongs to which account) plus the short-lived OAuth state.

CREATE TABLE IF NOT EXISTS connections (
  connection_id   TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  connector       TEXT NOT NULL,
  provider        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'connected',
  account         TEXT NOT NULL DEFAULT '',
  account_id      TEXT NOT NULL DEFAULT '',
  tenant_metadata TEXT NOT NULL DEFAULT '{}',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS connections_by_user ON connections (user_id, connector);

-- Re-consenting the same workspace/mailbox updates the row instead of piling up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS connections_account
  ON connections (user_id, connector, account_id);

-- One row per in-flight consent. The provider only ever sees `state`; everything the callback
-- needs (which user, which loopback port, which CSRF token the desktop expects back) is looked
-- up here, so none of it can be forged by whoever lands on the callback URL.
CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  connector  TEXT NOT NULL,
  provider   TEXT NOT NULL,
  redirect   TEXT NOT NULL,
  app_state  TEXT NOT NULL,
  access     TEXT NOT NULL DEFAULT '',
  flow       TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_states_expiry ON oauth_states (expires_at);

-- Relay routing: inbound Slack events and GitHub webhooks arrive addressed to a workspace or an
-- installation, and have to find the desktop sessions that asked for them.
CREATE TABLE IF NOT EXISTS slack_routes (
  team_id       TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS github_routes (
  installation_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  connection_id   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (installation_id, user_id)
);
