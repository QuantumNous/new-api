-- add_claude_opus_48_v2.sql
-- Correct schema দিয়ে claude-opus-4.8 channel তৈরি করো

-- Reference: existing MiMo channel data
SELECT id, type, name, key, base_url, models, model_mapping, status, priority, "group", tag, remark
FROM channels WHERE id = 85 LIMIT 1;

-- Insert new channel
INSERT INTO channels(
  type, key, name, base_url, models, model_mapping,
  status, priority, weight, "group", tag, remark,
  created_time, test_time, response_time, used_quota,
  balance_updated_time, auto_ban, other_info, other,
  status_code_mapping
)
SELECT
  type,
  key,
  'Claude Opus 4.8',
  base_url,
  'claude-opus-4.8',
  '{"claude-opus-4.8":"mimo-v2.5"}',
  1, 0, 0, 'default', 'Anthropic',
  'The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and problem solving.',
  EXTRACT(EPOCH FROM NOW())::bigint,
  0, 0, 0, 0, 1, '', '', ''
FROM channels WHERE id = 85;

-- abilities তৈরি করো
INSERT INTO abilities("group", model, channel_id, enabled, priority, weight, tag)
SELECT 'default', 'claude-opus-4.8', id, true, 0, 0, 'Anthropic'
FROM channels WHERE name = 'Claude Opus 4.8' AND models = 'claude-opus-4.8'
ORDER BY id DESC LIMIT 1;

-- Verify
SELECT id, name, status, models, type, base_url FROM channels WHERE models = 'claude-opus-4.8';
SELECT model, channel_id, enabled FROM abilities WHERE model = 'claude-opus-4.8';
