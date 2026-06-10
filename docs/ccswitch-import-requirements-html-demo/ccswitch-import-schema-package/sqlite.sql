-- CC Switch import schema package for SQLite.
-- Generated for the new-api CC Switch one-click import feature.

CREATE TABLE IF NOT EXISTS ccswitch_import_logs (
    id integer PRIMARY KEY AUTOINCREMENT,
    user_id integer,
    token_id integer,
    target varchar(64),
    model varchar(255),
    created_at bigint,
    ip varchar(64),
    user_agent varchar(512)
);

CREATE INDEX IF NOT EXISTS idx_ccswitch_import_logs_user_id
    ON ccswitch_import_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_ccswitch_import_logs_token_id
    ON ccswitch_import_logs (token_id);

CREATE INDEX IF NOT EXISTS idx_ccswitch_import_logs_created_at
    ON ccswitch_import_logs (created_at);

CREATE TABLE IF NOT EXISTS user_ccswitch_preferences (
    id integer PRIMARY KEY AUTOINCREMENT,
    user_id integer,
    last_target varchar(64),
    last_model varchar(255),
    updated_at bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ccswitch_preferences_user_id
    ON user_ccswitch_preferences (user_id);

-- Existing business dependency reference only.
-- Do not recreate this table in a production database that already has tokens.
CREATE TABLE IF NOT EXISTS tokens (
    id integer PRIMARY KEY AUTOINCREMENT,
    user_id integer,
    "key" varchar(128),
    status integer DEFAULT 1,
    name text,
    created_time bigint,
    accessed_time bigint,
    expired_time bigint DEFAULT -1,
    remain_quota integer DEFAULT 0,
    unlimited_quota numeric,
    model_limits_enabled numeric,
    model_limits text,
    allow_ips text DEFAULT '',
    used_quota integer DEFAULT 0,
    "group" text DEFAULT '',
    cross_group_retry numeric,
    deleted_at datetime
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_key
    ON tokens ("key");

CREATE INDEX IF NOT EXISTS idx_tokens_user_id
    ON tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_tokens_name
    ON tokens (name);

CREATE INDEX IF NOT EXISTS idx_tokens_deleted_at
    ON tokens (deleted_at);

