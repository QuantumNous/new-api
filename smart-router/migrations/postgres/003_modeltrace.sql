CREATE TABLE modeltrace_probes (
    probe_id VARCHAR(128) COLLATE "C" PRIMARY KEY NOT NULL
        CHECK (probe_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
    binding_id VARCHAR(128) NOT NULL REFERENCES bindings(id)
        CHECK (binding_id ~ '^bnd_[A-Za-z0-9_-]{24}$'),
    claimed_model VARCHAR(256) COLLATE "C" NOT NULL
        CHECK (CHAR_LENGTH(claimed_model) BETWEEN 1 AND 256
            AND OCTET_LENGTH(claimed_model) BETWEEN 1 AND 1024),
    protocol VARCHAR(32) COLLATE "C" NOT NULL
        CHECK (protocol IN ('chat', 'responses', 'messages', 'task_bridge')),
    evidence_sha256 VARCHAR(64) NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    bank_revision VARCHAR(64) NOT NULL CHECK (bank_revision ~ '^[0-9a-f]{64}$'),
    accepted_outputs INTEGER NOT NULL CHECK (accepted_outputs BETWEEN 1 AND 3),
    state VARCHAR(16) NOT NULL CHECK (state IN ('running', 'succeeded', 'failed', 'cancelled')),
    observed_ns BIGINT NOT NULL,
    error_code VARCHAR(32) NOT NULL DEFAULT '',
    terminal_ns BIGINT CHECK (terminal_ns IS NULL OR terminal_ns >= observed_ns),
    CHECK (
        (state = 'running' AND error_code = '' AND terminal_ns IS NULL)
        OR (state = 'succeeded' AND error_code = '' AND terminal_ns IS NOT NULL)
        OR (state = 'cancelled' AND error_code = 'cancelled' AND terminal_ns IS NOT NULL)
        OR (state = 'failed' AND terminal_ns IS NOT NULL AND error_code IN (
            'deadline_exceeded', 'execution_failed', 'configuration_invalid',
            'integrity_failed', 'process_limit', 'invalid_result', 'interrupted'))
    )
);
CREATE TABLE modeltrace_results (
    probe_id VARCHAR(128) COLLATE "C" PRIMARY KEY NOT NULL REFERENCES modeltrace_probes(probe_id),
    result_json TEXT NOT NULL CHECK (OCTET_LENGTH(result_json) BETWEEN 1 AND 262144),
    completed_ns BIGINT NOT NULL
);
CREATE INDEX modeltrace_latest
ON modeltrace_probes(binding_id, claimed_model, protocol, state, observed_ns DESC, probe_id DESC);
