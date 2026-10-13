ALTER TABLE decisions
ADD COLUMN decided_at_ns BIGINT NULL;

UPDATE decisions
SET decided_at_ns = created_at_ms * 1000000
WHERE decided_at_ns IS NULL;

ALTER TABLE decisions
MODIFY COLUMN decided_at_ns BIGINT NOT NULL;

ALTER TABLE decisions
DROP INDEX decisions_route_created;

CREATE INDEX decisions_route_decided
ON decisions(
    group_name,
    model_name,
    protocol,
    decided_at_ns DESC,
    request_id DESC
);
