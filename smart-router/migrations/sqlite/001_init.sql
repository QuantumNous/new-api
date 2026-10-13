PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    connector TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS route_groups (
    name TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS models (
    name TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS bindings (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    group_name TEXT NOT NULL REFERENCES route_groups(name),
    model_name TEXT NOT NULL REFERENCES models(name),
    protocol TEXT NOT NULL,
    protocol_plugin TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS prices (
    binding_id TEXT PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    cost_microunits INTEGER NOT NULL CHECK (cost_microunits >= 0)
);

CREATE TABLE IF NOT EXISTS health_state (
    binding_id TEXT PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    observed_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cooldowns (
    binding_id TEXT PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    until_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fingerprints (
    binding_id TEXT PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    observed_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
    request_id TEXT PRIMARY KEY,
    group_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    snapshot_revision TEXT NOT NULL,
    binding_ids_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS decisions_route_created
ON decisions(group_name, model_name, protocol, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS outcomes (
    event_id TEXT PRIMARY KEY,
    payload_sha256 TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    revision TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
);
