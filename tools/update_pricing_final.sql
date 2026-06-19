-- update_pricing_final.sql
-- ২০টা মডেলের সম্পূর্ণ pricing update
-- Formula: ModelRatio = Input$/2, CompletionRatio = Output$/Input$

-- ============================================================
-- ModelRatio (Input price / 2)
-- ============================================================
UPDATE options SET value = (value::jsonb || '{
  "claude-fable-5":    0.995,
  "claude-opus-4.8":   0.975,
  "claude-opus-4.7":   0.950,
  "claude-opus-4.6":   0.925,
  "claude-sonnet-4.6": 0.850,
  "claude-sonnet-4.5": 0.800,
  "gemini-3.1-pro":    0.925,
  "gemini-3-pro":      0.875,
  "gemini-2.5-pro":    0.750,
  "gemini-2.5-flash":  0.500,
  "grok-4.1":          0.950,
  "grok-4":            0.875,
  "grok-3":            0.725,
  "deepseek-v4-pro":   0.900,
  "deepseek-r1":       0.800,
  "deepseek-v4":       0.700,
  "deepseek-v3":       0.600,
  "gpt-5.5":           0.995,
  "gpt-5.4":           0.900,
  "gpt-5.3-codex":     0.775
}'::jsonb)::text
WHERE key = 'ModelRatio';

-- ============================================================
-- CompletionRatio (Output$ / Input$)
-- ============================================================
UPDATE options SET value = (value::jsonb || '{
  "claude-fable-5":    1.5025,
  "claude-opus-4.8":   1.5128,
  "claude-opus-4.7":   1.5263,
  "claude-opus-4.6":   1.5135,
  "claude-sonnet-4.6": 1.4706,
  "claude-sonnet-4.5": 1.4375,
  "gemini-3.1-pro":    1.5405,
  "gemini-3-pro":      1.5429,
  "gemini-2.5-pro":    1.5000,
  "gemini-2.5-flash":  1.7500,
  "grok-4.1":          1.5263,
  "grok-4":            1.5143,
  "grok-3":            1.4483,
  "deepseek-v4-pro":   1.5556,
  "deepseek-r1":       1.5000,
  "deepseek-v4":       1.5000,
  "deepseek-v3":       1.5833,
  "gpt-5.5":           1.5025,
  "gpt-5.4":           1.5556,
  "gpt-5.3-codex":     1.5161
}'::jsonb)::text
WHERE key = 'CompletionRatio';

-- ============================================================
-- VERIFY — দেখো ঠিকমতো গেছে কিনা
-- ============================================================
SELECT
  key,
  (value::jsonb -> 'claude-fable-5')::text    AS "claude-fable-5",
  (value::jsonb -> 'gemini-2.5-flash')::text  AS "gemini-2.5-flash",
  (value::jsonb -> 'gpt-5.5')::text           AS "gpt-5.5",
  (value::jsonb -> 'deepseek-v3')::text       AS "deepseek-v3"
FROM options
WHERE key IN ('ModelRatio', 'CompletionRatio');
