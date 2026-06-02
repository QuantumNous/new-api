-- Migration v0.5 — CJK strip defense-in-depth (Layer 1 Go + Layer 2 Python)
--
-- Adds the channel_global_settings table for global toggles (e.g. global strip_cjk).
-- Activates strip_cjk globally by default (defense-in-depth for all MiniMax channels).
-- Also enables use_global_strip_cjk on every channel that already has strip_cjk set
-- in its own settings, so the global key becomes the single source of truth.
--
-- Safe to run multiple times (idempotent).

-- 1. Create the table (also created by GORM AutoMigrate, but explicit is safer for ops).
CREATE TABLE IF NOT EXISTS channel_global_settings (
    key         VARCHAR(64) PRIMARY KEY,
    value       TEXT,
    updated_at  BIGINT
);

-- 2. Activate global strip_cjk (defense-in-depth: every channel with use_global_strip_cjk
--    in its settings will be stripped, regardless of its own strip_cjk value).
INSERT INTO channel_global_settings (key, value, updated_at)
VALUES ('strip_cjk', 'true', EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = EXTRACT(EPOCH FROM NOW())::bigint;

-- 3. Enable use_global_strip_cjk on all channels that already have strip_cjk=true in
--    their settings JSON, so the global key governs them.
--    PostgreSQL JSON update:
UPDATE channels
SET settings = jsonb_set(settings::jsonb, '{use_global_strip_cjk}', 'true')::text
WHERE type = 35
  AND settings::jsonb ? 'strip_cjk'
  AND (settings::jsonb->>'strip_cjk')::boolean = true
  AND NOT (settings::jsonb ? 'use_global_strip_cjk');

-- 4. For MiniMax channels (type=35) that DON'T have any strip_cjk config yet, opt them
--    into the global key so the layer 1 + layer 2 protection applies automatically.
UPDATE channels
SET settings = jsonb_set(
    COALESCE(settings::jsonb, '{}'::jsonb),
    '{use_global_strip_cjk}', 'true'
)::text
WHERE type = 35
  AND NOT (settings::jsonb ? 'use_global_strip_cjk');
