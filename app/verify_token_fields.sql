-- CustomPass Token Header 功能验证SQL脚本
-- 用于验证数据库中的token字段是否正确添加和使用

-- 1. 检查tasks表结构，确认token_id和token_key字段是否存在
DESCRIBE tasks;

-- 2. 查看最近的CustomPass任务记录，检查token信息
SELECT 
    id,
    task_id,
    platform,
    user_id,
    channel_id,
    token_id,
    token_key,
    action,
    status,
    submit_time,
    properties
FROM tasks 
WHERE platform = 'custompass' 
ORDER BY submit_time DESC 
LIMIT 10;

-- 3. 统计有token信息的任务数量
SELECT 
    COUNT(*) as total_tasks,
    COUNT(token_id) as tasks_with_token_id,
    COUNT(token_key) as tasks_with_token_key,
    COUNT(CASE WHEN token_id IS NOT NULL AND token_key IS NOT NULL THEN 1 END) as tasks_with_both_tokens
FROM tasks 
WHERE platform = 'custompass';

-- 4. 查看特定用户的任务token信息
-- 替换 USER_ID 为实际的用户ID
SELECT 
    t.task_id,
    t.token_id,
    t.token_key,
    tk.name as token_name,
    tk.key as full_token_key,
    t.submit_time
FROM tasks t
LEFT JOIN tokens tk ON t.token_id = tk.id
WHERE t.user_id = 1 -- 替换为实际用户ID
  AND t.platform = 'custompass'
ORDER BY t.submit_time DESC
LIMIT 5;

-- 5. 检查token表中的相关信息
SELECT 
    id,
    user_id,
    name,
    LEFT(key, 10) as key_prefix, -- 只显示key的前10个字符，保护隐私
    status,
    created_time
FROM tokens 
WHERE user_id IN (
    SELECT DISTINCT user_id 
    FROM tasks 
    WHERE platform = 'custompass' 
      AND token_id IS NOT NULL
)
ORDER BY created_time DESC
LIMIT 10;

-- 6. 验证token_id和token_key的一致性
SELECT 
    t.task_id,
    t.token_id,
    t.token_key,
    tk.key as actual_token_key,
    CASE 
        WHEN t.token_key = tk.key THEN 'MATCH'
        ELSE 'MISMATCH'
    END as consistency_check
FROM tasks t
JOIN tokens tk ON t.token_id = tk.id
WHERE t.platform = 'custompass'
  AND t.token_id IS NOT NULL
  AND t.token_key IS NOT NULL
ORDER BY t.submit_time DESC
LIMIT 10;

-- 7. 查看任务状态更新历史（如果有相关日志表）
-- 这个查询可能需要根据实际的日志表结构调整
SELECT 
    task_id,
    status,
    progress,
    updated_at
FROM tasks 
WHERE platform = 'custompass'
  AND task_id IN (
    SELECT task_id 
    FROM tasks 
    WHERE platform = 'custompass' 
      AND token_id IS NOT NULL 
    ORDER BY submit_time DESC 
    LIMIT 5
  )
ORDER BY task_id, updated_at;

-- 8. 检查不同渠道的CustomPass任务分布
SELECT 
    channel_id,
    COUNT(*) as task_count,
    COUNT(token_id) as tasks_with_token,
    MIN(submit_time) as first_task_time,
    MAX(submit_time) as last_task_time
FROM tasks 
WHERE platform = 'custompass'
GROUP BY channel_id
ORDER BY task_count DESC;
