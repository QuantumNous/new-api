-- insert_all_models.sql
-- 21টা model models table-এ insert করো
-- icon field EMPTY (vendor_id থেকে colorful icon আসবে automatically)

-- Anthropic (vendor_id=2) — 6 models
INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('[Bonus] Claude-opus-4.8',
$d$A bonus tier powered by 52 parallel Alibaba Qwen channels for maximum reliability, high throughput, and excellent availability. Best choice when performance and uptime matter most.$d$,
'', 'Coding,Reasoning,Analysis', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('claude-fable-5',
$d$Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing. The best choice for the most demanding tasks.$d$,
'', 'Coding,Reasoning,Writing', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('claude-opus-4.8',
$d$The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and multi-step problem solving.$d$,
'', 'Coding,Reasoning,Analysis', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('claude-opus-4.7',
$d$An advanced model in the powerful Opus series. Excellent at complex question analysis, detailed explanations, and creative writing.$d$,
'', 'Coding,Reasoning,Writing', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('claude-opus-4.6',
$d$A reliable and fast Opus model. Effective for everyday complex tasks, documentation, and code review.$d$,
'', 'Coding,Analysis', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('claude-sonnet-4.6',
$d$The perfect balance of speed and intelligence. Ideal for fast and reliable assistance in daily workflows.$d$,
'', 'General,Coding', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('claude-sonnet-4.5',
$d$An efficient and affordable model that delivers excellent results for simple to moderately complex tasks.$d$,
'', 'General,Coding', 2, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

-- Google (vendor_id=3) — 4 models
INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gemini-3.1-pro',
$d$Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis. Superior in long-context and reasoning tasks.$d$,
'', 'Coding,Reasoning,Multimodal', 3, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gemini-3-pro',
$d$An advanced pro model with powerful multimodal capabilities. Delivers high accuracy in research, coding, and analytical work.$d$,
'', 'Coding,Analysis,Multimodal', 3, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gemini-2.5-pro',
$d$Google's premium model with strong analytical capabilities and fast responses. Particularly useful for complex reasoning and coding.$d$,
'', 'Coding,Analysis', 3, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gemini-2.5-flash',
$d$Ultra-fast and cost-efficient. The best choice for general Q&A, summarization, and quick task execution.$d$,
'', 'General,Fast', 3, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

-- xAI (vendor_id=5) — 3 models
INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('grok-4.1',
$d$xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis.$d$,
'', 'Coding,Reasoning,Science', 5, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('grok-4',
$d$A powerful reasoning model. Extremely effective for math, science, and engineering problems.$d$,
'', 'Reasoning,Math,Science', 5, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('grok-3',
$d$Fast and reliable. An excellent assistant for everyday tasks and creative writing.$d$,
'', 'General,Writing', 5, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

-- DeepSeek (vendor_id=4) — 4 models
INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('deepseek-v4-pro',
$d$DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning.$d$,
'', 'Coding,Math,Reasoning', 4, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('deepseek-r1',
$d$A powerful reasoning model. Unmatched at solving complex problems step-by-step and in mathematics.$d$,
'', 'Reasoning,Math', 4, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('deepseek-v4',
$d$An advanced and efficient model. Delivers high-quality results in code generation, debugging, and data analysis.$d$,
'', 'Coding,Analysis', 4, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('deepseek-v3',
$d$Reliable and cost-effective. Maintains an excellent balance for simple to moderately complex tasks.$d$,
'', 'General,Coding', 4, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

-- OpenAI (vendor_id=6) — 3 models
INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gpt-5.5',
$d$OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task.$d$,
'', 'Coding,Reasoning,Writing', 6, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gpt-5.4',
$d$Powerful and versatile. Delivers high-quality results and stable performance in coding, writing, and analysis.$d$,
'', 'Coding,Analysis,Writing', 6, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

INSERT INTO models(model_name, description, icon, tags, vendor_id, status, created_time, updated_time)
VALUES('gpt-5.3-codex',
$d$A coding-specialized model. Exceptionally skilled in programming, debugging, and software design.$d$,
'', 'Coding', 6, 1,
EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT DO NOTHING;

-- Verify: total 21 models
SELECT vendor_id, COUNT(*) as count
FROM models
WHERE model_name IN (
  '[Bonus] Claude-opus-4.8', 'claude-fable-5', 'claude-opus-4.8',
  'claude-opus-4.7', 'claude-opus-4.6', 'claude-sonnet-4.6', 'claude-sonnet-4.5',
  'gemini-3.1-pro', 'gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash',
  'grok-4.1', 'grok-4', 'grok-3',
  'deepseek-v4-pro', 'deepseek-r1', 'deepseek-v4', 'deepseek-v3',
  'gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex'
) AND deleted_at IS NULL
GROUP BY vendor_id ORDER BY vendor_id;
