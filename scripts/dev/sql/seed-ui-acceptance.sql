-- DEV ONLY — AIOC_DEMO / UI_TEST UI acceptance fixtures
-- Target: docker-compose.dev.yml Postgres (new-api-dev-pg) ONLY.

BEGIN;

DO $$
DECLARE
  ts bigint := EXTRACT(EPOCH FROM NOW())::bigint;
  dev_hash text := '$2b$12$t8GeEMkXpZppWRWzdULAQ.sT1NEpdB3BW5OOpgMTQ2PMRPsnrV4Xa'; -- DevUi@123456
  uid_zhang int := 9101;
  uid_li int := 9102;
  cid int := 9101;
  mid int := 9101;
BEGIN
  -- Idempotent cleanup (same rules as cleanup-aioc-demo-data.sql)
  DELETE FROM logs
  WHERE token_name LIKE 'AIOC_DEMO%'
     OR content LIKE '%AIOC_DEMO%'
     OR content LIKE '%UI_TEST%'
     OR username LIKE 'aioc_demo_%'
     OR username IN ('UI_TEST_lisi')
     OR request_id LIKE 'AIOC_DEMO%'
     OR request_id LIKE 'aioc-demo-%';
  DELETE FROM tasks WHERE task_id LIKE 'AIOC_DEMO%' OR task_id LIKE 'aioc-demo-%';
  DELETE FROM midjourneys WHERE mj_id LIKE 'AIOC_DEMO%' OR mj_id LIKE 'aioc-demo-%';
  DELETE FROM tokens WHERE name LIKE 'AIOC_DEMO%' OR key LIKE 'sk-aioc-demo%' OR key LIKE 'AIOC_DEMO%';
  DELETE FROM abilities WHERE channel_id = cid OR model LIKE 'AIOC_DEMO%';
  DELETE FROM channels WHERE id = cid OR name LIKE 'AIOC_DEMO%';
  DELETE FROM models WHERE id = mid OR model_name LIKE 'AIOC_DEMO%';
  DELETE FROM users WHERE id IN (uid_zhang, uid_li) OR username LIKE 'aioc_demo_%' OR username = 'UI_TEST_lisi';
  UPDATE users SET remark = NULL, display_name = '张三丰'
  WHERE id = 2 AND username = '张三丰' AND remark LIKE '%AIOC_DEMO%';
  -- legacy seed ids
  DELETE FROM tokens WHERE id BETWEEN 9001 AND 9006;
  DELETE FROM tasks WHERE id BETWEEN 9001 AND 9004;
  DELETE FROM midjourneys WHERE id BETWEEN 9001 AND 9004;
  DELETE FROM channels WHERE id = 9001;
  DELETE FROM users WHERE id = 9001;

  -- B. Test accounts (do not create admin)
  INSERT INTO users (
    id, username, password, display_name, role, status, quota, used_quota,
    "group", remark, created_at, last_login_at
  ) VALUES
    (uid_zhang, 'aioc_demo_zhang', dev_hash, '张三丰', 1, 1, 150000000, 2500000,
     'default', 'AIOC_DEMO UI_TEST', ts, 0),
    (uid_li, 'aioc_demo_li', dev_hash, '李四', 1, 1, 1000000, 800000,
     'default', 'AIOC_DEMO UI_TEST', ts, 0);

  -- G. Model & channel
  INSERT INTO models (id, model_name, status, sync_official, created_time, updated_time)
  VALUES (mid, 'AIOC_DEMO_模型资源', 1, 1, ts, ts);

  INSERT INTO channels (
    id, type, key, status, name, created_time, models, "group", used_quota
  ) VALUES (
    cid, 1, 'sk-aioc-demo-channel-not-real-key', 1,
    'AIOC_DEMO_服务通道', ts, 'AIOC_DEMO_模型资源', 'default', 0
  );

  INSERT INTO abilities ("group", model, channel_id, enabled, priority, weight)
  VALUES ('default', 'AIOC_DEMO_模型资源', cid, true, 0, 0);

  -- C. API keys for aioc_demo_zhang
  INSERT INTO tokens (
    id, user_id, key, status, name, created_time, accessed_time, expired_time,
    remain_quota, unlimited_quota, model_limits_enabled, model_limits, allow_ips,
    used_quota, "group"
  ) VALUES
    (9101, uid_zhang, 'sk-aioc-demo-enabled-000000000001', 1, 'AIOC_DEMO_启用密钥',
     ts, ts, -1, 150000000, false, false, '', '', 0, 'default'),
    (9102, uid_zhang, 'sk-aioc-demo-disabled-000000000002', 2, 'AIOC_DEMO_停用密钥',
     ts, ts, -1, 150000000, false, false, '', '', 0, 'default'),
    (9103, uid_zhang, 'sk-aioc-demo-unlimited-000000000003', 1, 'AIOC_DEMO_不限额度密钥',
     ts, ts, -1, 0, true, false, '', '', 0, 'default'),
    (9104, uid_zhang, 'sk-aioc-demo-lowquota-000000000004', 1, 'AIOC_DEMO_快耗尽密钥',
     ts, ts, -1, 50000, false, false, '', '', 149900000, 'default'),
    (9105, uid_zhang, 'sk-aioc-demo-modellimit-000000000005', 1, 'AIOC_DEMO_模型限制密钥',
     ts, ts, -1, 150000000, false, true, 'AIOC_DEMO_模型资源', '', 0, 'default'),
    (9106, uid_zhang, 'sk-aioc-demo-iplimit-000000000006', 1, 'AIOC_DEMO_IP限制密钥',
     ts, ts, -1, 150000000, false, false, '', '127.0.0.1,192.168.1.100', 0, 'default');

  -- D. Common usage logs
  INSERT INTO logs (
    user_id, created_at, type, content, username, token_name, model_name,
    quota, prompt_tokens, completion_tokens, use_time, is_stream,
    channel_id, channel_name, token_id, "group", ip, request_id, other
  ) VALUES
    (uid_zhang, ts - 3600, 2,
     'AIOC_DEMO 消费：模型调用成功', 'aioc_demo_zhang', 'AIOC_DEMO_启用密钥', 'AIOC_DEMO_模型资源',
     12500, 1200, 800, 3, true, cid, 'AIOC_DEMO_服务通道', 9101, 'default', '127.0.0.1', 'aioc-demo-req-consume-001',
     '{"model_ratio":1,"completion_ratio":2,"group_ratio":1,"cache_tokens":3200,"cache_ratio":0.5,"billing_mode":"standard","request_path":"/v1/chat/completions"}'),
    (uid_zhang, ts - 3500, 3,
     '管理员增加用户额度 150000000 词元 AIOC_DEMO UI_TEST', 'aioc_demo_zhang', '', '',
     150000000, 0, 0, 0, false, 0, '', 0, 'default', '', 'aioc-demo-req-manage-001',
     '{"admin_info":{"admin_id":1,"admin_username":"admin"}}'),
    (uid_zhang, ts - 3400, 5,
     'AIOC_DEMO 失败：上游限流', 'aioc_demo_zhang', 'AIOC_DEMO_启用密钥', 'AIOC_DEMO_模型资源',
     0, 0, 0, 1, false, cid, 'AIOC_DEMO_服务通道', 9101, 'default', '10.0.0.8', 'aioc-demo-req-error-001',
     '{"reject_reason":"AIOC_DEMO 测试失败原因：rate limited","stream_status":{"status":"failed","end_reason":"error","end_error":"upstream 429"}}'),
    (uid_zhang, ts - 3300, 2,
     'AIOC_DEMO 缓存计费明细', 'aioc_demo_zhang', 'AIOC_DEMO_启用密钥', 'AIOC_DEMO_模型资源',
     8200, 500, 200, 2, true, cid, 'AIOC_DEMO_服务通道', 9101, 'default', '127.0.0.1', 'aioc-demo-req-cache-001',
     '{"cache_tokens":4096,"cache_creation_tokens":512,"cache_ratio":0.25,"model_ratio":1,"completion_ratio":2,"group_ratio":1,"frt":0.38}'),
    (uid_zhang, ts - 3200, 2,
     'AIOC_DEMO 订阅扣费', 'aioc_demo_zhang', 'AIOC_DEMO_启用密钥', 'AIOC_DEMO_模型资源',
     3000, 100, 50, 1, false, cid, 'AIOC_DEMO_服务通道', 9101, 'default', '127.0.0.1', 'aioc-demo-req-sub-001',
     '{"billing_source":"subscription","subscription_plan_title":"AIOC_DEMO 订阅方案","subscription_id":"91001","subscription_consumed":3000,"subscription_remain":97000,"subscription_total":100000}'),
    (uid_li, ts - 3100, 2,
     'AIOC_DEMO 李四低额度消费', 'aioc_demo_li', 'AIOC_DEMO_启用密钥', 'AIOC_DEMO_模型资源',
     500, 50, 20, 1, false, cid, 'AIOC_DEMO_服务通道', 9101, 'default', '127.0.0.2', 'aioc-demo-req-li-001',
     '{}');

  -- E. Task audit logs (no Midjourney naming)
  INSERT INTO tasks (
    id, created_at, updated_at, task_id, platform, user_id, "group", channel_id,
    quota, action, status, fail_reason, submit_time, start_time, finish_time,
    progress, properties, data
  ) VALUES
    (9101, ts, ts, 'AIOC_DEMO-任务审计-成功-001', 'suno', uid_zhang, 'default', cid,
     5000, 'MUSIC', 'SUCCESS', '', ts - 600, ts - 580, ts - 120,
     '100%', '{"origin_model_name":"AIOC_DEMO_模型资源"}',
     '[]'),
    (9102, ts, ts, 'AIOC_DEMO-任务审计-进行中-001', 'suno', uid_zhang, 'default', cid,
     0, 'MUSIC', 'IN_PROGRESS', '', ts - 300, ts - 280, 0,
     '45%', '{"origin_model_name":"AIOC_DEMO_模型资源"}',
     '[]'),
    (9103, ts, ts, 'AIOC_DEMO-任务审计-失败-001', 'suno', uid_zhang, 'default', cid,
     0, 'MUSIC', 'FAILURE',
     'AIOC_DEMO 任务审计失败：音频生成超时，请检查服务通道或稍后重试。',
     ts - 900, ts - 880, ts - 800,
     '100%', '{"origin_model_name":"AIOC_DEMO_模型资源"}',
     '[]'),
    (9104, ts, ts, 'AIOC_DEMO-任务审计-音频-001', 'suno', uid_zhang, 'default', cid,
     3000, 'MUSIC', 'SUCCESS', '', ts - 200, ts - 180, ts - 60,
     '100%', '{"origin_model_name":"AIOC_DEMO_模型资源"}',
     '[{"audio_url":"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3","title":"AIOC_DEMO 音频预览"}]');

  -- F. Drawing audit logs
  INSERT INTO midjourneys (
    id, code, user_id, action, mj_id, prompt, prompt_en, status, progress,
    submit_time, start_time, finish_time, image_url, fail_reason, channel_id, quota
  ) VALUES
    (9101, 1, uid_zhang, 'IMAGINE', 'AIOC_DEMO-绘图审计-成功-001',
     'AIOC_DEMO 绘图提示词：赛博朋克城市夜景，霓虹灯', 'AIOC_DEMO cyberpunk night city',
     'SUCCESS', '100%', ts - 500, ts - 480, ts - 400,
     'https://picsum.photos/seed/aioc-demo-draw-ok/480/320', '', cid, 8000),
    (9102, 1, uid_zhang, 'IMAGINE', 'AIOC_DEMO-绘图审计-进行中-001',
     'AIOC_DEMO 绘图提示词：水彩山峦湖泊', 'AIOC_DEMO watercolor landscape',
     'IN_PROGRESS', '60%', ts - 200, ts - 180, 0,
     '', '', cid, 0),
    (9103, 22, uid_zhang, 'IMAGINE', 'AIOC_DEMO-绘图审计-失败-001',
     'AIOC_DEMO 绘图提示词：人物肖像测试', 'AIOC_DEMO portrait test',
     'FAILURE', '100%', ts - 800, ts - 780, ts - 700,
     '', 'AIOC_DEMO 绘图审计失败：内容策略拦截（测试数据）', cid, 0),
    (9104, 1, uid_zhang, 'VARIATION', 'AIOC_DEMO-绘图审计-提示词-001',
     'AIOC_DEMO 绘图提示词：古风少女，汉服，樱花', 'AIOC_DEMO hanfu cherry blossom',
     'SUCCESS', '100%', ts - 100, ts - 90, ts - 30,
     'https://picsum.photos/seed/aioc-demo-draw-var/480/320', '', cid, 4000);

END $$;

COMMIT;
