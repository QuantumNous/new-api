-- restore_all_pricing.sql
-- ২০টা model এর pricing + descriptions পুনরায় সেট

-- ============================================================
-- 1) ModelRatio (Input price / 2)
-- ============================================================
UPDATE options SET value = '{
  "claude-fable-5": 0.495,
  "claude-opus-4.8": 0.490,
  "claude-opus-4.7": 0.485,
  "claude-opus-4.6": 0.480,
  "claude-sonnet-4.6": 0.450,
  "claude-sonnet-4.5": 0.440,
  "gemini-3.1-pro": 0.475,
  "gemini-3-pro": 0.460,
  "gemini-2.5-pro": 0.425,
  "gemini-2.5-flash": 0.375,
  "grok-4.1": 0.485,
  "grok-4": 0.470,
  "grok-3": 0.430,
  "deepseek-v4-pro": 0.475,
  "deepseek-r1": 0.450,
  "deepseek-v4": 0.425,
  "deepseek-v3": 0.400,
  "gpt-5.5": 0.495,
  "gpt-5.4": 0.475,
  "gpt-5.3-codex": 0.445
}'
WHERE key = 'ModelRatio';

-- ============================================================
-- 2) CompletionRatio (Output/Input)
-- ============================================================
UPDATE options SET value = '{
  "claude-fable-5": 2.0202,
  "claude-opus-4.8": 2.0204,
  "claude-opus-4.7": 2.0103,
  "claude-opus-4.6": 1.9792,
  "claude-sonnet-4.6": 1.9444,
  "claude-sonnet-4.5": 1.9318,
  "gemini-3.1-pro": 2.0000,
  "gemini-3-pro": 2.0109,
  "gemini-2.5-pro": 2.0000,
  "gemini-2.5-flash": 2.0000,
  "grok-4.1": 2.0103,
  "grok-4": 1.9681,
  "grok-3": 1.9186,
  "deepseek-v4-pro": 2.0000,
  "deepseek-r1": 2.0000,
  "deepseek-v4": 2.0000,
  "deepseek-v3": 2.0000,
  "gpt-5.5": 2.0202,
  "gpt-5.4": 2.0000,
  "gpt-5.3-codex": 1.9663
}'
WHERE key = 'CompletionRatio';

-- ============================================================
-- 3) Models table — descriptions + vendor_id
-- ============================================================
DELETE FROM models;

INSERT INTO models(model_name,description,status,tags,vendor_id) VALUES
('claude-fable-5','Anthropic''s most advanced flagship model. Delivers unmatched performance in complex analysis, deep reasoning, creative writing, and long-context processing.',1,'["flagship","reasoning","coding","creative"]',1),
('claude-opus-4.8','The latest and most capable version of the powerful Opus series. Exceptionally skilled at multi-step coding, in-depth research analysis, and complex problem solving.',1,'["advanced","coding","research","analysis"]',1),
('claude-opus-4.7','An advanced model in the powerful Opus series. Excellent at complex question analysis, detailed explanations, and high-quality creative content generation.',1,'["advanced","analysis","creative","writing"]',1),
('claude-opus-4.6','A reliable and fast Opus model. Highly effective for everyday complex tasks, code review, technical documentation, and structured output generation.',1,'["standard","coding","documentation"]',1),
('claude-sonnet-4.6','The perfect balance of intelligence and speed. Ideal for fast, reliable assistance across daily workflows, customer support, and content generation.',1,'["balanced","fast","versatile"]',1),
('claude-sonnet-4.5','An efficient and affordable Claude model that delivers excellent quality for simple to moderately complex tasks. Great for high-volume applications.',1,'["efficient","affordable","general"]',1),

('gemini-3.1-pro','Google''s most advanced multimodal model. Outstanding at processing text, code, images, and complex data analysis with superior long-context understanding.',1,'["flagship","multimodal","reasoning","coding"]',3),
('gemini-3-pro','An advanced Pro model with powerful multimodal capabilities. Delivers high accuracy in scientific research, code generation, and complex analytical tasks.',1,'["advanced","multimodal","research","analysis"]',3),
('gemini-2.5-pro','Google''s premium model offering strong analytical capabilities and fast response times. Effective for complex reasoning, coding, and data processing.',1,'["standard","reasoning","coding","fast"]',3),
('gemini-2.5-flash','Ultra-fast and highly cost-efficient. The best choice for general Q&A, text summarization, simple coding tasks, and high-volume applications.',1,'["fast","efficient","general","affordable"]',3),

('grok-4.1','xAI''s latest flagship model. A top performer in deep scientific thinking, advanced coding, mathematical reasoning, and complex multi-step logical analysis.',1,'["flagship","reasoning","math","coding"]',7),
('grok-4','A powerful reasoning-focused model from xAI. Extremely effective for solving complex mathematical, scientific, and engineering problems with precision.',1,'["advanced","math","science","reasoning"]',7),
('grok-3','Fast and reliable general-purpose model from xAI. An excellent assistant for everyday tasks, creative writing, and straightforward analytical work.',1,'["standard","general","creative","fast"]',7),

('deepseek-v4-pro','DeepSeek''s most capable flagship model. World-class performance in mathematics, competitive programming, scientific reasoning, and complex agentic workflows.',1,'["flagship","math","coding","reasoning"]',8),
('deepseek-r1','A powerful chain-of-thought reasoning model. Unmatched at solving complex problems step-by-step, mathematical proofs, and logical deduction tasks.',1,'["advanced","reasoning","math","cot"]',8),
('deepseek-v4','An advanced and highly efficient coding model. Delivers high-quality results in code generation, debugging, refactoring, and technical documentation.',1,'["standard","coding","debugging","technical"]',8),
('deepseek-v3','Reliable and cost-effective general model. Maintains an excellent balance of quality and efficiency for simple to moderately complex tasks at scale.',1,'["efficient","general","affordable","versatile"]',8),

('gpt-5.5','OpenAI''s most capable and intelligent model. Unrivaled in accuracy, creativity, nuanced reasoning, and deep analysis across any domain or task complexity.',1,'["flagship","reasoning","creative","analysis"]',2),
('gpt-5.4','Powerful and highly versatile. Delivers high-quality, stable performance across coding, writing, research, and analysis with excellent instruction-following.',1,'["advanced","versatile","coding","writing"]',2),
('gpt-5.3-codex','A coding-specialized model optimized for software development. Exceptionally skilled in code generation, debugging, code review, and architecture design.',1,'["coding","debugging","architecture","specialized"]',2);

-- ============================================================
-- VERIFY
-- ============================================================
SELECT count(*) AS model_count FROM models;
SELECT key, LEFT(value,80) FROM options WHERE key IN ('ModelRatio','CompletionRatio');
