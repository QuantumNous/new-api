DELETE FROM models WHERE model_name='claude-opus-4.8' AND tags='Coding' AND deleted_at IS NULL;

SELECT model_name, icon, vendor_id, tags FROM models
WHERE model_name IN (
  'claude-fable-5','claude-opus-4.8','claude-opus-4.7','claude-opus-4.6',
  'claude-sonnet-4.6','claude-sonnet-4.5',
  'gemini-3.1-pro','gemini-3-pro','gemini-2.5-pro','gemini-2.5-flash',
  'grok-4.1','grok-4','grok-3',
  'deepseek-v4-pro','deepseek-r1','deepseek-v4','deepseek-v3',
  'gpt-5.5','gpt-5.4','gpt-5.3-codex'
)
ORDER BY vendor_id, model_name;
