-- fix_bonus_name.sql
-- claude-opus-4.8-bonus → [Bonus] Claude-opus-4.8

-- 1. channels.models field
UPDATE channels
SET models = '[Bonus] Claude-opus-4.8'
WHERE name LIKE 'ANT-%' AND models = 'claude-opus-4.8-bonus';

-- 2. channels.model_mapping (JSON key rename)
UPDATE channels
SET model_mapping = REPLACE(model_mapping::text, '"claude-opus-4.8-bonus":', '"[Bonus] Claude-opus-4.8":')
WHERE name LIKE 'ANT-%';

-- 3. abilities table
UPDATE abilities
SET model = '[Bonus] Claude-opus-4.8'
WHERE model = 'claude-opus-4.8-bonus';

-- 4. options: ModelRatio
UPDATE options
SET value = (
  (value::jsonb - 'claude-opus-4.8-bonus') || '{"[Bonus] Claude-opus-4.8": 0.35}'::jsonb
)::text
WHERE key = 'ModelRatio';

-- 5. options: CompletionRatio
UPDATE options
SET value = (
  (value::jsonb - 'claude-opus-4.8-bonus') || '{"[Bonus] Claude-opus-4.8": 2}'::jsonb
)::text
WHERE key = 'CompletionRatio';

-- Verify
SELECT 'channels models:' AS info, COUNT(*) FROM channels WHERE models = '[Bonus] Claude-opus-4.8';
SELECT 'abilities:' AS info, COUNT(*) FROM abilities WHERE model = '[Bonus] Claude-opus-4.8';
SELECT 'ModelRatio:' AS info, value::jsonb->>'[Bonus] Claude-opus-4.8' AS ratio FROM options WHERE key = 'ModelRatio';
