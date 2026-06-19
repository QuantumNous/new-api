-- delete_bonus_model.sql
-- [Bonus] Claude-opus-4.8 সম্পূর্ণ মুছে দাও

-- 1. models table থেকে soft-delete
UPDATE models
SET deleted_at = NOW()
WHERE model_name = '[Bonus] Claude-opus-4.8'
AND deleted_at IS NULL;

-- 2. abilities table থেকে disable
UPDATE abilities
SET enabled = false
WHERE model = '[Bonus] Claude-opus-4.8';

-- 3. 52টা ANT channels disable করো
UPDATE channels
SET status = 2
WHERE name LIKE 'ANT-%' AND models = '[Bonus] Claude-opus-4.8';

-- 4. ModelRatio থেকে remove
UPDATE options
SET value = (value::jsonb - '[Bonus] Claude-opus-4.8')::text
WHERE key = 'ModelRatio';

-- 5. CompletionRatio থেকে remove
UPDATE options
SET value = (value::jsonb - '[Bonus] Claude-opus-4.8')::text
WHERE key = 'CompletionRatio';

-- Verify
SELECT 'models deleted:' AS info, COUNT(*) FROM models WHERE model_name = '[Bonus] Claude-opus-4.8' AND deleted_at IS NOT NULL;
SELECT 'ANT channels disabled:' AS info, COUNT(*) FROM channels WHERE name LIKE 'ANT-%' AND status = 2;
