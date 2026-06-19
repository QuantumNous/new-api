-- add_claude_opus_48.sql
-- claude-opus-4.8 channel যোগ করো (MiMo backed)

INSERT INTO channels(
  type, name, key, base_url, models, model_mapping,
  status, priority, weight, "group", tag, remark,
  created_time, tested_time, response_time, balance,
  balance_updated_time, used_quota, request_count, config, other_info
)
VALUES(
  1,
  'Claude Opus 4.8',
  'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi',
  'https://api.xiaomimimo.com/v1',
  'claude-opus-4.8',
  '{"claude-opus-4.8":"mimo-v2.5"}',
  1,
  0,
  0,
  'default',
  'Anthropic',
  'The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and multi-step problem solving.',
  EXTRACT(EPOCH FROM NOW())::bigint,
  0, 0, 0, 0, 0, 0, '{}', '{}'
);

-- abilities table-এ যোগ করো
INSERT INTO abilities("group", model, channel_id, enabled, priority, weight, tag)
SELECT 'default', 'claude-opus-4.8', id, true, 0, 0, 'Anthropic'
FROM channels WHERE name = 'Claude Opus 4.8' AND models = 'claude-opus-4.8' ORDER BY id DESC LIMIT 1;

-- Verify
SELECT id, name, status, models, priority FROM channels WHERE name = 'Claude Opus 4.8';
SELECT model, channel_id, enabled FROM abilities WHERE model = 'claude-opus-4.8';
