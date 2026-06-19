UPDATE channels SET remark=$remark$Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing. The best choice for the most demanding tasks.$remark$ WHERE name='Claude Fable 5';
UPDATE channels SET remark=$remark$Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis. Superior in long-context and reasoning tasks.$remark$ WHERE name='Gemini 3.1 Pro';
UPDATE channels SET remark=$remark$Google's premium model with strong analytical capabilities and fast responses. Particularly useful for complex reasoning and coding.$remark$ WHERE name='Gemini 2.5 Pro';
UPDATE channels SET remark=$remark$xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis.$remark$ WHERE name='Grok 4.1';
UPDATE channels SET remark=$remark$DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning.$remark$ WHERE name='DeepSeek V4-Pro';
UPDATE channels SET remark=$remark$OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task.$remark$ WHERE name='GPT-5.5';

INSERT INTO models(model_name,description,tags,status,created_time,updated_time)
VALUES('claude-fable-5',$d$Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing.$d$,'anthropic,claude,flagship',1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT(model_name,deleted_at) DO UPDATE SET description=EXCLUDED.description, tags=EXCLUDED.tags;

INSERT INTO models(model_name,description,tags,status,created_time,updated_time)
VALUES('gemini-3.1-pro',$d$Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis.$d$,'google,gemini,pro',1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT(model_name,deleted_at) DO UPDATE SET description=EXCLUDED.description, tags=EXCLUDED.tags;

INSERT INTO models(model_name,description,tags,status,created_time,updated_time)
VALUES('grok-4.1',$d$xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis.$d$,'xai,grok,flagship',1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT(model_name,deleted_at) DO UPDATE SET description=EXCLUDED.description, tags=EXCLUDED.tags;

INSERT INTO models(model_name,description,tags,status,created_time,updated_time)
VALUES('gemini-2.5-pro',$d$Google's premium model with strong analytical capabilities and fast responses.$d$,'google,gemini,pro',1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT(model_name,deleted_at) DO UPDATE SET description=EXCLUDED.description, tags=EXCLUDED.tags;

INSERT INTO models(model_name,description,tags,status,created_time,updated_time)
VALUES('deepseek-v4-pro',$d$DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning.$d$,'deepseek,pro',1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT(model_name,deleted_at) DO UPDATE SET description=EXCLUDED.description, tags=EXCLUDED.tags;

INSERT INTO models(model_name,description,tags,status,created_time,updated_time)
VALUES('gpt-5.5',$d$OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task.$d$,'openai,gpt,flagship',1,EXTRACT(EPOCH FROM NOW())::bigint,EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT(model_name,deleted_at) DO UPDATE SET description=EXCLUDED.description, tags=EXCLUDED.tags;
