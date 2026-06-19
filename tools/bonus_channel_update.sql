-- bonus_channel_update.sql
-- 1. ANT channels: claude-opus-4.8 → claude-opus-4.8-bonus
-- 2. Pricing set করো
-- 3. Remark/description যোগ করো

-- Step 1: Update models field
UPDATE channels
SET models = 'claude-opus-4.8-bonus'
WHERE name LIKE 'ANT-%' AND models = 'claude-opus-4.8';

-- Step 2: Update model_mapping (replace key in JSON)
UPDATE channels
SET model_mapping = REPLACE(model_mapping::text, '"claude-opus-4.8":', '"claude-opus-4.8-bonus":')
WHERE name LIKE 'ANT-%';

-- Step 3: Update abilities table
UPDATE abilities
SET model = 'claude-opus-4.8-bonus'
WHERE model = 'claude-opus-4.8' AND channel_id BETWEEN 33 AND 84;

-- Step 4: Add remark to all ANT channels
UPDATE channels
SET remark = 'A bonus tier of Claude Opus 4.8, powered by 52 parallel Alibaba Qwen channels for maximum reliability, high throughput, and excellent availability. Best choice when performance and uptime matter most.'
WHERE name LIKE 'ANT-%';

-- Step 5: Add pricing for claude-opus-4.8-bonus
-- Input $0.70/M → ratio=0.35 | Output $1.40/M → completion=2
UPDATE options
SET value = (value::jsonb || '{"claude-opus-4.8-bonus": 0.35}'::jsonb)::text
WHERE key = 'ModelRatio';

UPDATE options
SET value = (value::jsonb || '{"claude-opus-4.8-bonus": 2}'::jsonb)::text
WHERE key = 'CompletionRatio';

-- Verify
SELECT 'ANT channels updated:' AS info, COUNT(*) FROM channels WHERE name LIKE 'ANT-%' AND models = 'claude-opus-4.8-bonus';
SELECT 'Abilities updated:' AS info, COUNT(*) FROM abilities WHERE model = 'claude-opus-4.8-bonus';
SELECT 'ModelRatio bonus:' AS info, value::jsonb->>'claude-opus-4.8-bonus' AS ratio FROM options WHERE key = 'ModelRatio';
