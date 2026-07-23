BEGIN;

CREATE TABLE IF NOT EXISTS async_jobs (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL UNIQUE,
    token_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    endpoint_type VARCHAR(40) NOT NULL,
    request_payload BYTEA NOT NULL,
    request_hash CHAR(64) NOT NULL,
    idempotency_key VARCHAR(191) NOT NULL,
    execution_status VARCHAR(20) NOT NULL,
    worker_id VARCHAR(128) NOT NULL DEFAULT '',
    lease_until BIGINT NOT NULL DEFAULT 0,
    attempt INTEGER NOT NULL DEFAULT 0,
    request_sent_at BIGINT NOT NULL DEFAULT 0,
    result_payload JSONB,
    error_phase VARCHAR(40) NOT NULL DEFAULT '',
    error_code VARCHAR(80) NOT NULL DEFAULT '',
    refund_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    billing_status VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
    billing_request_id VARCHAR(64) NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT async_jobs_token_idempotency_unique UNIQUE (token_id, idempotency_key),
    CONSTRAINT fk_async_jobs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_async_jobs_status_lease ON async_jobs(execution_status, lease_until);
CREATE INDEX IF NOT EXISTS idx_async_jobs_channel_id ON async_jobs(channel_id);
CREATE INDEX IF NOT EXISTS idx_async_jobs_request_sent_at ON async_jobs(request_sent_at);
CREATE INDEX IF NOT EXISTS idx_async_jobs_billing_status ON async_jobs(billing_status);

CREATE TABLE IF NOT EXISTS artifacts (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    object_key VARCHAR(512) NOT NULL UNIQUE,
    content_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    source_url_hash CHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    CONSTRAINT fk_artifacts_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires_at ON artifacts(expires_at);

CREATE TABLE IF NOT EXISTS task_events (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    from_status VARCHAR(20) NOT NULL DEFAULT '',
    to_status VARCHAR(20) NOT NULL DEFAULT '',
    worker_id VARCHAR(128) NOT NULL DEFAULT '',
    error_phase VARCHAR(40) NOT NULL DEFAULT '',
    error_code VARCHAR(80) NOT NULL DEFAULT '',
    actor_type VARCHAR(20) NOT NULL DEFAULT '',
    actor_id BIGINT NOT NULL DEFAULT 0,
    details JSONB,
    created_at BIGINT NOT NULL,
    CONSTRAINT fk_task_events_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_event_type ON task_events(event_type);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'async_jobs'::regclass AND conname = 'fk_async_jobs_task') THEN
        ALTER TABLE async_jobs
            ADD CONSTRAINT fk_async_jobs_task
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'artifacts'::regclass AND conname = 'fk_artifacts_task') THEN
        ALTER TABLE artifacts
            ADD CONSTRAINT fk_artifacts_task
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'task_events'::regclass AND conname = 'fk_task_events_task') THEN
        ALTER TABLE task_events
            ADD CONSTRAINT fk_task_events_task
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END
$$;

COMMIT;
