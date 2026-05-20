-- DEV ONLY — remove all AIOC_DEMO / UI_TEST / aioc_demo_* fixtures.
-- Predicates use explicit test markers only; never delete by display names like 张三丰.

BEGIN;

DELETE FROM logs
WHERE token_name LIKE 'AIOC_DEMO%'
   OR content LIKE '%AIOC_DEMO%'
   OR content LIKE '%UI_TEST%'
   OR username LIKE 'aioc_demo_%'
   OR username = 'UI_TEST_lisi'
   OR user_id IN (9001, 9101, 9102)
   OR request_id LIKE 'AIOC_DEMO%'
   OR request_id LIKE 'aioc-demo-%';

DELETE FROM tasks
WHERE task_id LIKE 'AIOC_DEMO%'
   OR task_id LIKE 'aioc-demo-%'
   OR user_id IN (9001, 9101, 9102);

DELETE FROM midjourneys
WHERE mj_id LIKE 'AIOC_DEMO%'
   OR mj_id LIKE 'aioc-demo-%'
   OR prompt LIKE '%AIOC_DEMO%'
   OR user_id IN (9001, 9101, 9102);

DELETE FROM tokens
WHERE name LIKE 'AIOC_DEMO%'
   OR key LIKE 'AIOC_DEMO%'
   OR key LIKE 'sk-aioc-demo%'
   OR id BETWEEN 9001 AND 9006
   OR id BETWEEN 9101 AND 9106
   OR user_id IN (9001, 9101, 9102);

DELETE FROM abilities
WHERE channel_id IN (9001, 9101)
   OR model LIKE 'AIOC_DEMO%';

DELETE FROM channels
WHERE name LIKE 'AIOC_DEMO%'
   OR key LIKE 'sk-aioc-demo%'
   OR id IN (9001, 9101);

DELETE FROM models
WHERE model_name LIKE 'AIOC_DEMO%'
   OR id IN (9001, 9101);

DELETE FROM users
WHERE id IN (9001, 9101, 9102)
   OR username LIKE 'aioc_demo_%'
   OR username = 'UI_TEST_lisi';

COMMIT;
