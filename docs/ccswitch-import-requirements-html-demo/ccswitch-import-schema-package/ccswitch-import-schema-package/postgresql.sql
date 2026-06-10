-- CC Switch import schema package for PostgreSQL 9.6+.
-- Generated for the new-api CC Switch one-click import feature.

CREATE TABLE IF NOT EXISTS ccswitch_import_logs (
    id bigserial PRIMARY KEY,
    user_id bigint,
    token_id bigint,
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
    id bigserial PRIMARY KEY,
    user_id bigint,
    last_target varchar(64),
    last_model varchar(255),
    updated_at bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ccswitch_preferences_user_id
    ON user_ccswitch_preferences (user_id);

-- Existing business dependency reference only.
-- Do not recreate this table in a production database that already has tokens.
CREATE TABLE IF NOT EXISTS tokens (
    id bigserial PRIMARY KEY,
    user_id bigint,
    key varchar(128),
    status bigint DEFAULT 1,
    name varchar(191),
    created_time bigint,
    accessed_time bigint,
    expired_time bigint DEFAULT -1,
    remain_quota bigint DEFAULT 0,
    unlimited_quota boolean,
    model_limits_enabled boolean,
    model_limits text,
    allow_ips text DEFAULT '',
    used_quota bigint DEFAULT 0,
    "group" varchar(191) DEFAULT '',
    cross_group_retry boolean,
    deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_key
    ON tokens (key);

CREATE INDEX IF NOT EXISTS idx_tokens_user_id
    ON tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_tokens_name
    ON tokens (name);

CREATE INDEX IF NOT EXISTS idx_tokens_deleted_at
    ON tokens (deleted_at);

-- Existing tokens migration note:
-- token key must be varchar(128). Legacy char(48) deployments should be migrated
-- by the project's GORM migration path, not by dropping or recreating tokens.

