-- update_pricing_v2.sql
-- নতুন pricing সেট (ModelRatio = Input$/2, CompletionRatio = Output$/Input$)

UPDATE options SET value = (value::jsonb || '{
  "claude-fable-5":    0.495,
  "claude-opus-4.8":   0.490,
  "claude-opus-4.7":   0.485,
  "claude-opus-4.6":   0.480,
  "claude-sonnet-4.6": 0.450,
  "claude-sonnet-4.5": 0.440,
  "gemini-3.1-pro":    0.475,
  "gemini-3-pro":      0.460,
  "gemini-2.5-pro":    0.425,
  "gemini-2.5-flash":  0.375,
  "grok-4.1":          0.485,
  "grok-4":            0.470,
  "grok-3":            0.430,
  "deepseek-v4-pro":   0.475,
  "deepseek-r1":       0.450,
  "deepseek-v4":       0.425,
  "deepseek-v3":       0.400,
  "gpt-5.5":           0.495,
  "gpt-5.4":           0.475,
  "gpt-5.3-codex":     0.445
}'::jsonb)::text
WHERE key = 'ModelRatio';

UPDATE options SET value = (value::jsonb || '{
  "claude-fable-5":    2.0202,
  "claude-opus-4.8":   2.0204,
  "claude-opus-4.7":   2.0103,
  "claude-opus-4.6":   1.9792,
  "claude-sonnet-4.6": 1.9444,
  "claude-sonnet-4.5": 1.9318,
  "gemini-3.1-pro":    2.0000,
  "gemini-3-pro":      2.0109,
  "gemini-2.5-pro":    2.0000,
  "gemini-2.5-flash":  2.0000,
  "grok-4.1":          2.0103,
  "grok-4":            1.9681,
  "grok-3":            1.9186,
  "deepseek-v4-pro":   2.0000,
  "deepseek-r1":       2.0000,
  "deepseek-v4":       2.0000,
  "deepseek-v3":       2.0000,
  "gpt-5.5":           2.0202,
  "gpt-5.4":           2.0000,
  "gpt-5.3-codex":     1.9663
}'::jsonb)::text
WHERE key = 'CompletionRatio';

-- Verify
SELECT key,
  (value::jsonb -> 'claude-fable-5')::text   AS "claude-fable-5",
  (value::jsonb -> 'gemini-2.5-flash')::text AS "gemini-2.5-flash",
  (value::jsonb -> 'deepseek-v3')::text      AS "deepseek-v3",
  (value::jsonb -> 'gpt-5.5')::text          AS "gpt-5.5"
FROM options
WHERE key IN ('ModelRatio','CompletionRatio');
