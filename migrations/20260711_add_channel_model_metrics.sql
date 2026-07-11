-- channel_model_metrics: model-level health & experience metrics (PRD §32)
-- Idempotent: safe to re-run on SQLite / MySQL / PostgreSQL via IF NOT EXISTS.
-- Runtime role / lease / concurrency / probe queue are NOT persisted here.

CREATE TABLE IF NOT EXISTS channel_model_metrics (
    channel_id BIGINT NOT NULL,
    effective_model VARCHAR(191) NOT NULL,
    route_state VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    last_error_class VARCHAR(16) NULL,
    cooldown_until BIGINT NULL,
    backoff_level INT NOT NULL DEFAULT 0,
    production_sample_count BIGINT NOT NULL DEFAULT 0,
    shadow_sample_count BIGINT NOT NULL DEFAULT 0,
    production_success_ema DOUBLE PRECISION NULL,
    shadow_transport_success_ema DOUBLE PRECISION NULL,
    temporary_error_ema DOUBLE PRECISION NULL,
    rate_limit_ema DOUBLE PRECISION NULL,
    timeout_ema DOUBLE PRECISION NULL,
    stream_interruption_ema DOUBLE PRECISION NULL,
    production_ttft_ema_ms DOUBLE PRECISION NULL,
    shadow_ttft_ema_ms DOUBLE PRECISION NULL,
    production_total_latency_ema_ms DOUBLE PRECISION NULL,
    shadow_total_latency_ema_ms DOUBLE PRECISION NULL,
    production_tokens_per_second_ema DOUBLE PRECISION NULL,
    shadow_calibration_json TEXT NULL,
    experience_score DOUBLE PRECISION NULL,
    last_request_at BIGINT NULL,
    last_success_at BIGINT NULL,
    last_failure_at BIGINT NULL,
    last_probe_at BIGINT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (channel_id, effective_model)
);
