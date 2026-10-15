CREATE TABLE modeltrace_probes (
    probe_id TEXT COLLATE BINARY PRIMARY KEY NOT NULL
        CHECK (typeof(probe_id) = 'text' AND length(probe_id) BETWEEN 1 AND 128
            AND substr(probe_id, 1, 1) GLOB '[A-Za-z0-9]'
            AND probe_id NOT GLOB '*[^A-Za-z0-9._:-]*'),
    binding_id TEXT NOT NULL REFERENCES bindings(id)
        CHECK (length(binding_id) = 28 AND substr(binding_id, 1, 4) = 'bnd_'
            AND substr(binding_id, 5) NOT GLOB '*[^A-Za-z0-9_-]*'),
    claimed_model TEXT COLLATE BINARY NOT NULL
        CHECK (typeof(claimed_model) = 'text' AND length(claimed_model) BETWEEN 1 AND 256
            AND length(CAST(claimed_model AS BLOB)) BETWEEN 1 AND 1024),
    protocol TEXT COLLATE BINARY NOT NULL
        CHECK (protocol IN ('chat', 'responses', 'messages', 'task_bridge')),
    evidence_sha256 TEXT NOT NULL
        CHECK (length(evidence_sha256) = 64 AND evidence_sha256 NOT GLOB '*[^0-9a-f]*'),
    bank_revision TEXT NOT NULL
        CHECK (length(bank_revision) = 64 AND bank_revision NOT GLOB '*[^0-9a-f]*'),
    accepted_outputs INTEGER NOT NULL
        CHECK (typeof(accepted_outputs) = 'integer' AND accepted_outputs BETWEEN 1 AND 3),
    state TEXT NOT NULL CHECK (state IN ('running', 'succeeded', 'failed', 'cancelled')),
    observed_ns INTEGER NOT NULL CHECK (typeof(observed_ns) = 'integer'),
    error_code TEXT NOT NULL DEFAULT '',
    terminal_ns INTEGER CHECK (terminal_ns IS NULL
        OR (typeof(terminal_ns) = 'integer' AND terminal_ns >= observed_ns)),
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
    probe_id TEXT COLLATE BINARY PRIMARY KEY NOT NULL REFERENCES modeltrace_probes(probe_id),
    result_json TEXT NOT NULL CHECK (typeof(result_json) = 'text'
        AND length(CAST(result_json AS BLOB)) BETWEEN 1 AND 262144),
    completed_ns INTEGER NOT NULL CHECK (typeof(completed_ns) = 'integer')
);
CREATE INDEX modeltrace_latest
ON modeltrace_probes(binding_id, claimed_model, protocol, state, observed_ns DESC, probe_id DESC);
