-- channel_model_policy: model-level routing policy (PRD §32)
-- Idempotent: safe to re-run on SQLite / MySQL / PostgreSQL via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS channel_model_policy (
    channel_id BIGINT NOT NULL,
    requested_model VARCHAR(191) NOT NULL,
    manual_priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(32) NOT NULL DEFAULT 'configured',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (channel_id, requested_model)
);
