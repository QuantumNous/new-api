-- fix_models_complete.sql
-- Cleans duplicates and sets correct vendor_id, icon, tags for all 20 models

-- Step 1: Delete all our inserted entries (duplicates with wrong tags)
DELETE FROM models WHERE model_name IN (
  'claude-fable-5','claude-opus-4.8','claude-opus-4.7','claude-opus-4.6',
  'claude-sonnet-4.6','claude-sonnet-4.5',
  'gemini-3.1-pro','gemini-3-pro','gemini-2.5-pro','gemini-2.5-flash',
  'grok-4.1','grok-4','grok-3',
  'deepseek-v4-pro','deepseek-r1','deepseek-v4','deepseek-v3',
  'gpt-5.5','gpt-5.4','gpt-5.3-codex'
) AND deleted_at IS NULL;

-- Step 2: Insert all 20 models correctly
-- Anthropic (vendor_id=2, icon=Claude)
INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('claude-fable-5',$d$Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing. The best choice for the most demanding tasks.$d$,'Claude','Coding,Reasoning,Writing',2,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('claude-opus-4.8',$d$The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and multi-step problem solving.$d$,'Claude','Coding,Reasoning,Analysis',2,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('claude-opus-4.7',$d$An advanced model in the powerful Opus series. Excellent at complex question analysis, detailed explanations, and creative writing.$d$,'Claude','Coding,Reasoning,Writing',2,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('claude-opus-4.6',$d$A reliable and fast Opus model. Effective for everyday complex tasks, documentation, and code review.$d$,'Claude','Coding,Analysis',2,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('claude-sonnet-4.6',$d$The perfect balance of speed and intelligence. Ideal for fast and reliable assistance in daily workflows.$d$,'Claude','General,Coding',2,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('claude-sonnet-4.5',$d$An efficient and affordable model that delivers excellent results for simple to moderately complex tasks.$d$,'Claude','General,Coding',2,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

-- Google (vendor_id=3, icon=Gemini)
INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gemini-3.1-pro',$d$Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis. Superior in long-context and reasoning tasks.$d$,'Gemini','Coding,Reasoning,Multimodal',3,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gemini-3-pro',$d$An advanced pro model with powerful multimodal capabilities. Delivers high accuracy in research, coding, and analytical work.$d$,'Gemini','Coding,Analysis,Multimodal',3,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gemini-2.5-pro',$d$Google's premium model with strong analytical capabilities and fast responses. Particularly useful for complex reasoning and coding.$d$,'Gemini','Coding,Analysis',3,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gemini-2.5-flash',$d$Ultra-fast and cost-efficient. The best choice for general Q&A, summarization, and quick task execution.$d$,'Gemini','General,Fast',3,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

-- xAI (vendor_id=5, icon=Grok)
INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('grok-4.1',$d$xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis.$d$,'Grok','Coding,Reasoning,Science',5,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('grok-4',$d$A powerful reasoning model. Extremely effective for math, science, and engineering problems.$d$,'Grok','Reasoning,Math,Science',5,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('grok-3',$d$Fast and reliable. An excellent assistant for everyday tasks and creative writing.$d$,'Grok','General,Writing',5,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

-- DeepSeek (vendor_id=4, icon=DeepSeek)
INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('deepseek-v4-pro',$d$DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning.$d$,'DeepSeek','Coding,Math,Reasoning',4,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('deepseek-r1',$d$A powerful reasoning model. Unmatched at solving complex problems step-by-step and in mathematics.$d$,'DeepSeek','Reasoning,Math',4,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('deepseek-v4',$d$An advanced and efficient model. Delivers high-quality results in code generation, debugging, and data analysis.$d$,'DeepSeek','Coding,Analysis',4,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('deepseek-v3',$d$Reliable and cost-effective. Maintains an excellent balance for simple to moderately complex tasks.$d$,'DeepSeek','General,Coding',4,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

-- OpenAI (vendor_id=6, icon=OpenAI)
INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gpt-5.5',$d$OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task.$d$,'OpenAI','Coding,Reasoning,Writing',6,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gpt-5.4',$d$Powerful and versatile. Delivers high-quality results and stable performance in coding, writing, and analysis.$d$,'OpenAI','Coding,Analysis,Writing',6,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

INSERT INTO models(model_name,description,icon,tags,vendor_id,status,created_time,updated_time)
VALUES('gpt-5.3-codex',$d$A coding-specialized model. Exceptionally skilled in programming, debugging, and software design.$d$,'OpenAI','Coding',6,1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint);

-- Verify
SELECT model_name, icon, vendor_id, tags FROM models
WHERE model_name IN (
  'claude-fable-5','claude-opus-4.8','gemini-3.1-pro','grok-4.1','deepseek-v4-pro','gpt-5.5'
)
ORDER BY vendor_id, model_name;
