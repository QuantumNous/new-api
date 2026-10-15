CREATE TABLE modeltrace_probes (
    probe_id VARBINARY(128) PRIMARY KEY NOT NULL,
    binding_id VARCHAR(128) NOT NULL,
    claimed_model VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    protocol VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    evidence_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    bank_revision CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    accepted_outputs INTEGER NOT NULL,
    state VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    observed_ns BIGINT NOT NULL,
    error_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    terminal_ns BIGINT NULL,
    FOREIGN KEY (binding_id) REFERENCES bindings(id),
    CHECK (OCTET_LENGTH(probe_id) BETWEEN 1 AND 128
        AND probe_id REGEXP '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
    CHECK (OCTET_LENGTH(binding_id) = 28 AND binding_id REGEXP '^bnd_[A-Za-z0-9_-]{24}$'),
    CHECK (CHAR_LENGTH(claimed_model) BETWEEN 1 AND 256
        AND OCTET_LENGTH(claimed_model) BETWEEN 1 AND 1024),
    CHECK (protocol IN ('chat', 'responses', 'messages', 'task_bridge')),
    CHECK (evidence_sha256 REGEXP '^[0-9a-f]{64}$'),
    CHECK (bank_revision REGEXP '^[0-9a-f]{64}$'),
    CHECK (accepted_outputs BETWEEN 1 AND 3),
    CHECK (terminal_ns IS NULL OR terminal_ns >= observed_ns),
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
    probe_id VARBINARY(128) PRIMARY KEY NOT NULL,
    result_json MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    completed_ns BIGINT NOT NULL,
    FOREIGN KEY (probe_id) REFERENCES modeltrace_probes(probe_id),
    CHECK (OCTET_LENGTH(result_json) BETWEEN 1 AND 262144)
);
-- Prefixes keep the key below the legacy 767-byte InnoDB budget with utf8mb4.
CREATE INDEX modeltrace_latest
ON modeltrace_probes(binding_id(28), claimed_model(64), protocol, state, observed_ns DESC, probe_id DESC);
