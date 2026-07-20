\set ON_ERROR_STOP on

-- Usage:
--   psql "$SQL_DSN" -v channel_ids='{2,4}' \
--     -f deploy/sql/channel_param_compatibility.sql
--
-- Run the SELECT first and retain its output for rollback. The update keeps
-- unrelated overrides and adds missing delete operations for unsupported
-- sampling parameters.

BEGIN;

SELECT id, name, param_override
FROM channels
WHERE id = ANY(:'channel_ids'::bigint[])
ORDER BY id;

WITH selected AS (
    SELECT
        id,
        CASE
            WHEN NULLIF(BTRIM(param_override), '') IS NULL THEN '{}'::jsonb
            ELSE param_override::jsonb
        END AS override_json
    FROM channels
    WHERE id = ANY(:'channel_ids'::bigint[])
), normalized AS (
    SELECT
        id,
        override_json,
        CASE
            WHEN jsonb_typeof(override_json->'operations') = 'array'
                THEN override_json->'operations'
            ELSE '[]'::jsonb
        END AS operations
    FROM selected
), patched AS (
    SELECT
        id,
        jsonb_set(
            override_json,
            '{operations}',
            operations
                || CASE
                    WHEN operations @> '[{"path":"temperature","mode":"delete"}]'::jsonb
                        THEN '[]'::jsonb
                    ELSE '[{"path":"temperature","mode":"delete"}]'::jsonb
                END
                || CASE
                    WHEN operations @> '[{"path":"top_p","mode":"delete"}]'::jsonb
                        THEN '[]'::jsonb
                    ELSE '[{"path":"top_p","mode":"delete"}]'::jsonb
                END,
            true
        ) AS override_json
    FROM normalized
)
UPDATE channels AS channel
SET param_override = patched.override_json::text
FROM patched
WHERE channel.id = patched.id;

SELECT id, name, param_override
FROM channels
WHERE id = ANY(:'channel_ids'::bigint[])
ORDER BY id;

COMMIT;
