-- create_mimo_channels_fresh.sql
-- সব ২০টা MiMo channel তৈরি করো (fresh start)
-- Backend: mimo-v2.5 | Base URL: https://api.xiaomimimo.com/v1
-- Key: sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi

-- ============================================================
-- ANTHROPIC — 6 channels
-- ============================================================

-- 1. claude-fable-5 (Flagship $0.90/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Claude Fable 5','https://api.xiaomimimo.com/v1','claude-fable-5','{"claude-fable-5":"mimo-v2.5"}',1,0,0,'default','Anthropic',
$r$Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing. The best choice for the most demanding tasks.$r$,
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 2. claude-opus-4.8 (Advanced $0.70/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Claude Opus 4.8','https://api.xiaomimimo.com/v1','claude-opus-4.8','{"claude-opus-4.8":"mimo-v2.5"}',1,0,0,'default','Anthropic',
'The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and multi-step problem solving.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 3. claude-opus-4.7 (Advanced $0.70/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Claude Opus 4.7','https://api.xiaomimimo.com/v1','claude-opus-4.7','{"claude-opus-4.7":"mimo-v2.5"}',1,0,0,'default','Anthropic',
'An advanced model in the powerful Opus series. Excellent at complex question analysis, detailed explanations, and creative writing.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 4. claude-opus-4.6 (Standard $0.50/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Claude Opus 4.6','https://api.xiaomimimo.com/v1','claude-opus-4.6','{"claude-opus-4.6":"mimo-v2.5"}',1,0,0,'default','Anthropic',
'A reliable and fast Opus model. Effective for everyday complex tasks, documentation, and code review.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 5. claude-sonnet-4.6 (Standard $0.50/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Claude Sonnet 4.6','https://api.xiaomimimo.com/v1','claude-sonnet-4.6','{"claude-sonnet-4.6":"mimo-v2.5"}',1,0,0,'default','Anthropic',
'The perfect balance of speed and intelligence. Ideal for fast and reliable assistance in daily workflows.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 6. claude-sonnet-4.5 (Lite $0.30/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Claude Sonnet 4.5','https://api.xiaomimimo.com/v1','claude-sonnet-4.5','{"claude-sonnet-4.5":"mimo-v2.5"}',1,0,0,'default','Anthropic',
'An efficient and affordable model that delivers excellent results for simple to moderately complex tasks.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- ============================================================
-- GOOGLE — 4 channels
-- ============================================================

-- 7. gemini-3.1-pro (Flagship $0.90/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Gemini 3.1 Pro','https://api.xiaomimimo.com/v1','gemini-3.1-pro','{"gemini-3.1-pro":"mimo-v2.5"}',1,0,0,'default','Google',
$r$Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis. Superior in long-context and reasoning tasks.$r$,
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 8. gemini-3-pro (Advanced $0.70/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Gemini 3 Pro','https://api.xiaomimimo.com/v1','gemini-3-pro','{"gemini-3-pro":"mimo-v2.5"}',1,0,0,'default','Google',
'An advanced pro model with powerful multimodal capabilities. Delivers high accuracy in research, coding, and analytical work.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 9. gemini-2.5-pro (Standard $0.50/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Gemini 2.5 Pro','https://api.xiaomimimo.com/v1','gemini-2.5-pro','{"gemini-2.5-pro":"mimo-v2.5"}',1,0,0,'default','Google',
$r$Google's premium model with strong analytical capabilities and fast responses. Particularly useful for complex reasoning and coding.$r$,
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 10. gemini-2.5-flash (Lite $0.30/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Gemini 2.5 Flash','https://api.xiaomimimo.com/v1','gemini-2.5-flash','{"gemini-2.5-flash":"mimo-v2.5"}',1,0,0,'default','Google',
'Ultra-fast and cost-efficient. The best choice for general Q&A, summarization, and quick task execution.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- ============================================================
-- xAI — 3 channels
-- ============================================================

-- 11. grok-4.1 (Flagship $0.90/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Grok 4.1','https://api.xiaomimimo.com/v1','grok-4.1','{"grok-4.1":"mimo-v2.5"}',1,0,0,'default','xAI',
$r$xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis.$r$,
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 12. grok-4 (Advanced $0.70/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Grok 4','https://api.xiaomimimo.com/v1','grok-4','{"grok-4":"mimo-v2.5"}',1,0,0,'default','xAI',
'A powerful reasoning model. Extremely effective for math, science, and engineering problems.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 13. grok-3 (Standard $0.50/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','Grok 3','https://api.xiaomimimo.com/v1','grok-3','{"grok-3":"mimo-v2.5"}',1,0,0,'default','xAI',
'Fast and reliable. An excellent assistant for everyday tasks and creative writing.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- ============================================================
-- DEEPSEEK — 4 channels
-- ============================================================

-- 14. deepseek-v4-pro (Flagship $0.90/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','DeepSeek V4-Pro','https://api.xiaomimimo.com/v1','deepseek-v4-pro','{"deepseek-v4-pro":"mimo-v2.5"}',1,0,0,'default','DeepSeek',
$r$DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning.$r$,
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 15. deepseek-r1 (Advanced $0.70/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','DeepSeek R1','https://api.xiaomimimo.com/v1','deepseek-r1','{"deepseek-r1":"mimo-v2.5"}',1,0,0,'default','DeepSeek',
'A powerful reasoning model. Unmatched at solving complex problems step-by-step and in mathematics.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 16. deepseek-v4 (Standard $0.50/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','DeepSeek V4','https://api.xiaomimimo.com/v1','deepseek-v4','{"deepseek-v4":"mimo-v2.5"}',1,0,0,'default','DeepSeek',
'An advanced and efficient model. Delivers high-quality results in code generation, debugging, and data analysis.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 17. deepseek-v3 (Lite $0.30/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','DeepSeek V3','https://api.xiaomimimo.com/v1','deepseek-v3','{"deepseek-v3":"mimo-v2.5"}',1,0,0,'default','DeepSeek',
'Reliable and cost-effective. Maintains an excellent balance for simple to moderately complex tasks.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- ============================================================
-- OPENAI — 3 channels
-- ============================================================

-- 18. gpt-5.5 (Flagship $0.90/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','GPT-5.5','https://api.xiaomimimo.com/v1','gpt-5.5','{"gpt-5.5":"mimo-v2.5"}',1,0,0,'default','OpenAI',
$r$OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task.$r$,
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 19. gpt-5.4 (Advanced $0.70/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','GPT-5.4','https://api.xiaomimimo.com/v1','gpt-5.4','{"gpt-5.4":"mimo-v2.5"}',1,0,0,'default','OpenAI',
'Powerful and versatile. Delivers high-quality results and stable performance in coding, writing, and analysis.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- 20. gpt-5.3-codex (Standard $0.50/M input)
INSERT INTO channels(type,key,name,base_url,models,model_mapping,status,priority,weight,"group",tag,remark,created_time,test_time,response_time,used_quota,balance_updated_time,auto_ban,other_info,other,status_code_mapping)
VALUES(1,'sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi','GPT-5.3-Codex','https://api.xiaomimimo.com/v1','gpt-5.3-codex','{"gpt-5.3-codex":"mimo-v2.5"}',1,0,0,'default','OpenAI',
'A coding-specialized model. Exceptionally skilled in programming, debugging, and software design.',
EXTRACT(EPOCH FROM NOW())::bigint,0,0,0,0,1,'','','');

-- ============================================================
-- ABILITIES TABLE — সব 20 channel-এর জন্য
-- ============================================================
INSERT INTO abilities("group", model, channel_id, enabled, priority, weight, tag)
SELECT 'default', c.models, c.id, true, 0, 0, c.tag
FROM channels c
WHERE c.name IN (
  'Claude Fable 5','Claude Opus 4.8','Claude Opus 4.7','Claude Opus 4.6',
  'Claude Sonnet 4.6','Claude Sonnet 4.5',
  'Gemini 3.1 Pro','Gemini 3 Pro','Gemini 2.5 Pro','Gemini 2.5 Flash',
  'Grok 4.1','Grok 4','Grok 3',
  'DeepSeek V4-Pro','DeepSeek R1','DeepSeek V4','DeepSeek V3',
  'GPT-5.5','GPT-5.4','GPT-5.3-Codex'
);

-- ============================================================
-- PRICING — ModelRatio + CompletionRatio
-- ============================================================

-- Flagship tier: $0.90/M input → ratio=0.45
-- Advanced tier: $0.70/M input → ratio=0.35
-- Standard tier: $0.50/M input → ratio=0.25
-- Lite tier:     $0.30/M input → ratio=0.15
-- All output = 2x input → completion_ratio=2

UPDATE options SET value = (value::jsonb || '{
  "claude-fable-5": 0.45,
  "claude-opus-4.8": 0.35,
  "claude-opus-4.7": 0.35,
  "claude-opus-4.6": 0.25,
  "claude-sonnet-4.6": 0.25,
  "claude-sonnet-4.5": 0.15,
  "gemini-3.1-pro": 0.45,
  "gemini-3-pro": 0.35,
  "gemini-2.5-pro": 0.25,
  "gemini-2.5-flash": 0.15,
  "grok-4.1": 0.45,
  "grok-4": 0.35,
  "grok-3": 0.25,
  "deepseek-v4-pro": 0.45,
  "deepseek-r1": 0.35,
  "deepseek-v4": 0.25,
  "deepseek-v3": 0.15,
  "gpt-5.5": 0.45,
  "gpt-5.4": 0.35,
  "gpt-5.3-codex": 0.25
}'::jsonb)::text
WHERE key = 'ModelRatio';

UPDATE options SET value = (value::jsonb || '{
  "claude-fable-5": 2,
  "claude-opus-4.8": 2,
  "claude-opus-4.7": 2,
  "claude-opus-4.6": 2,
  "claude-sonnet-4.6": 2,
  "claude-sonnet-4.5": 2,
  "gemini-3.1-pro": 2,
  "gemini-3-pro": 2,
  "gemini-2.5-pro": 2,
  "gemini-2.5-flash": 2,
  "grok-4.1": 2,
  "grok-4": 2,
  "grok-3": 2,
  "deepseek-v4-pro": 2,
  "deepseek-r1": 2,
  "deepseek-v4": 2,
  "deepseek-v3": 2,
  "gpt-5.5": 2,
  "gpt-5.4": 2,
  "gpt-5.3-codex": 2
}'::jsonb)::text
WHERE key = 'CompletionRatio';

-- ============================================================
-- VERIFY
-- ============================================================
SELECT COUNT(*) as total_channels FROM channels WHERE status = 1;
SELECT COUNT(*) as total_abilities FROM abilities WHERE enabled = true;
