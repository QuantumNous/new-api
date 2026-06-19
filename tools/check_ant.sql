-- Check Alibaba channels
SELECT id, name, models, LEFT(model_mapping, 50)
FROM channels
WHERE name LIKE 'ANT-%'
ORDER BY id
LIMIT 5;
