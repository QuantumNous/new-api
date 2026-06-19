-- Check all claude-opus-4.8 channels (any status)
SELECT id, name, status, models, priority, base_url
FROM channels
WHERE models = 'claude-opus-4.8';

-- Also check abilities
SELECT model, channel_id, enabled FROM abilities WHERE model = 'claude-opus-4.8';
