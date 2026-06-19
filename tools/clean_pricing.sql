-- DELETE EVERYTHING from pricing

-- 1) ModelRatio → empty
UPDATE options SET value = '{}' WHERE key = 'ModelRatio';

-- 2) CompletionRatio → empty  
UPDATE options SET value = '{}' WHERE key = 'CompletionRatio';

-- 3) ModelPrice → empty
UPDATE options SET value = '{}' WHERE key = 'ModelPrice';

-- 4) CacheRatio → empty
UPDATE options SET value = '{}' WHERE key = 'CacheRatio';

-- 5) CreateCacheRatio → empty
UPDATE options SET value = '{}' WHERE key = 'CreateCacheRatio';

-- 6) ImageRatio → empty
UPDATE options SET value = '{}' WHERE key = 'ImageRatio';

-- 7) AudioRatio → empty
UPDATE options SET value = '{}' WHERE key = 'AudioRatio';

-- 8) AudioCompletionRatio → empty
UPDATE options SET value = '{}' WHERE key = 'AudioCompletionRatio';

-- 9) models table → সব মুছো
DELETE FROM models;

-- Verify
SELECT key, value FROM options WHERE key IN ('ModelRatio','CompletionRatio','ModelPrice');
SELECT count(*) AS remaining_models FROM models;
