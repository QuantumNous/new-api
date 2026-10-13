CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(128) PRIMARY KEY,
    connector VARCHAR(128) NOT NULL,
    enabled BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS route_groups (
    name VARCHAR(128) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS models (
    name VARCHAR(256) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS bindings (
    id VARCHAR(128) PRIMARY KEY,
    source_id VARCHAR(128) NOT NULL REFERENCES sources(id),
    group_name VARCHAR(128) NOT NULL REFERENCES route_groups(name),
    model_name VARCHAR(256) NOT NULL REFERENCES models(name),
    protocol VARCHAR(32) NOT NULL,
    protocol_plugin VARCHAR(128) NOT NULL,
    enabled BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS prices (
    binding_id VARCHAR(128) PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    cost_microunits BIGINT NOT NULL CHECK (cost_microunits >= 0)
);
CREATE TABLE IF NOT EXISTS health_state (
    binding_id VARCHAR(128) PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    observed_at_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS cooldowns (
    binding_id VARCHAR(128) PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    until_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS fingerprints (
    binding_id VARCHAR(128) PRIMARY KEY REFERENCES bindings(id) ON DELETE CASCADE,
    value CHAR(64) NOT NULL,
    observed_at_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
    request_id VARCHAR(128) PRIMARY KEY,
    group_name VARCHAR(128) NOT NULL,
    model_name VARCHAR(256) NOT NULL,
    protocol VARCHAR(32) NOT NULL,
    snapshot_revision VARCHAR(128) NOT NULL,
    binding_ids_json TEXT NOT NULL,
    created_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS decisions_route_created
ON decisions(group_name, model_name, protocol, created_at_ms DESC);
CREATE TABLE IF NOT EXISTS outcomes (
    event_id VARCHAR(128) PRIMARY KEY,
    payload_sha256 CHAR(64) NOT NULL,
    payload_json TEXT NOT NULL,
    created_at_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
    revision VARCHAR(128) PRIMARY KEY,
    payload_json TEXT NOT NULL,
    created_at_ms BIGINT NOT NULL
);
