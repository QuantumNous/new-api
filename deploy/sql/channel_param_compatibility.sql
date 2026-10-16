\set ON_ERROR_STOP on

-- Required psql variables:
--   azure_override: compact JSON for gpt-5.6-sol
--   fable_override: compact JSON for claude-fable-5
--
-- Prefer apply_channel_param_overrides.sh, which loads and validates the
-- version-controlled JSON profiles before invoking this transaction.

BEGIN;

SELECT id, name, param_override
FROM channels
WHERE name IN (
    'AWS-B',
    '0718-OR',
    'az-ch0718',
    '07-19-AZ-COLIN-OF-001'
)
ORDER BY id;

UPDATE channels
SET param_override = CASE
    WHEN name IN ('AWS-B', '0718-OR') THEN :'fable_override'
    WHEN name IN ('az-ch0718', '07-19-AZ-COLIN-OF-001') THEN :'azure_override'
    ELSE param_override
END
WHERE name IN (
    'AWS-B',
    '0718-OR',
    'az-ch0718',
    '07-19-AZ-COLIN-OF-001'
);

SELECT id, name, param_override
FROM channels
WHERE name IN (
    'AWS-B',
    '0718-OR',
    'az-ch0718',
    '07-19-AZ-COLIN-OF-001'
)
ORDER BY id;

COMMIT;
