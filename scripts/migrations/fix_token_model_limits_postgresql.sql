-- 修复 tokens 表 model_limits 字段长度限制问题
-- 问题：当模型列表过长时，varchar(1024) 会导致 "value too long for type character varying(1024)" 错误
-- 解决：将字段类型从 varchar(1024) 改为 text

-- PostgreSQL
ALTER TABLE tokens ALTER COLUMN model_limits TYPE TEXT;
