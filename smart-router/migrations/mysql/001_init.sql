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
    source_id VARCHAR(128) NOT NULL,
    group_name VARCHAR(128) NOT NULL,
    model_name VARCHAR(256) NOT NULL,
    protocol VARCHAR(32) NOT NULL,
    protocol_plugin VARCHAR(128) NOT NULL,
    enabled BOOLEAN NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id),
    FOREIGN KEY (group_name) REFERENCES route_groups(name),
    FOREIGN KEY (model_name) REFERENCES models(name)
);
CREATE TABLE IF NOT EXISTS prices (
    binding_id VARCHAR(128) PRIMARY KEY,
    cost_microunits BIGINT NOT NULL,
    FOREIGN KEY (binding_id) REFERENCES bindings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS health_state (
    binding_id VARCHAR(128) PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    observed_at_ms BIGINT NOT NULL,
    FOREIGN KEY (binding_id) REFERENCES bindings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cooldowns (
    binding_id VARCHAR(128) PRIMARY KEY,
    until_ms BIGINT NOT NULL,
    FOREIGN KEY (binding_id) REFERENCES bindings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS fingerprints (
    binding_id VARCHAR(128) PRIMARY KEY,
    value CHAR(64) NOT NULL,
    observed_at_ms BIGINT NOT NULL,
    FOREIGN KEY (binding_id) REFERENCES bindings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS decisions (
    request_id VARCHAR(128) PRIMARY KEY,
    group_name VARCHAR(128) NOT NULL,
    model_name VARCHAR(256) NOT NULL,
    protocol VARCHAR(32) NOT NULL,
    snapshot_revision VARCHAR(128) NOT NULL,
    binding_ids_json TEXT NOT NULL,
    created_at_ms BIGINT NOT NULL,
    INDEX decisions_route_created (group_name, model_name, protocol, created_at_ms)
);
CREATE TABLE IF NOT EXISTS outcomes (
    event_id VARCHAR(128) PRIMARY KEY,
    payload_sha256 CHAR(64) NOT NULL,
    payload_json TEXT NOT NULL,
    created_at_ms BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
    revision VARCHAR(128) PRIMARY KEY,
    payload_json LONGTEXT NOT NULL,
    created_at_ms BIGINT NOT NULL
);
