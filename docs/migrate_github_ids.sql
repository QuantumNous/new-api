-- ===================================================================
-- GitHub OAuth数据迁移脚本
-- 将旧的GitHub登录名（login）迁移为数字ID（id）
--
-- 使用时机：在部署新的GitHub OAuth代码之前运行此脚本
-- ===================================================================

-- ===================================================================
-- 说明
-- ===================================================================
-- 旧代码：github_id 存储的是 GitHub 用户名 (例如 "alice")
-- 新代码：github_id 存储的是 GitHub 数字ID (例如 "12345678")
--
-- 本脚本会将旧的用户名更新为对应的数字ID，避免用户无法登录
-- ===================================================================

-- ===================================================================
-- 步骤1：创建备份（重要！）
-- ===================================================================
-- 在运行此脚本前，请先备份数据库：
--
-- MySQL:
--   mysqldump -u root -p new_api > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
--
-- PostgreSQL:
--   pg_dump new_api > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
--
-- SQLite:
--   cp new-api.db backup_before_migration_$(date +%Y%m%d_%H%M%S).db

-- ===================================================================
-- 步骤2：查看需要迁移的用户
-- ===================================================================
-- 查看所有使用GitHub登录的用户及其当前的github_id格式
SELECT
    id,
    username,
    github_id,
    email,
    created_time
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL
ORDER BY id;

-- ===================================================================
-- 步骤3：迁移数据（自动模式）
-- ===================================================================
-- 注意：此脚本需要通过调用GitHub API来获取数字ID
-- 请使用配套的Go工具或手动模式

-- 方案A：使用Go工具（推荐）
-- 1. 编译工具：go build -o migrate_github_ids docs/migrate_github_ids.go
-- 2. 运行工具：./migrate_github_ids
-- 3. 工具会自动查询GitHub API并更新数据库

-- 方案B：手动迁移（如果用户数量少）
-- 1. 对每个用户，访问 https://api.github.com/users/{旧的用户名}
-- 2. 获取 "id" 字段的值（数字ID）
-- 3. 执行更新语句：

-- 示例：假设用户 "alice" 的GitHub数字ID是 12345678
/*
-- 方案1：直接匹配（推荐，避免自引用子查询）
UPDATE users
SET github_id = '12345678'
WHERE github_id = 'alice'
  AND deleted_at IS NULL
LIMIT 1;

-- 方案2：使用变量（MySQL 8.0+）
SET @user_id = (SELECT id FROM users WHERE github_id = 'alice' AND deleted_at IS NULL LIMIT 1);
UPDATE users
SET github_id = '12345678'
WHERE id = @user_id;

-- 方案3：分步执行
-- 先查询ID
SELECT id FROM users WHERE github_id = 'alice' AND deleted_at IS NULL LIMIT 1;
-- 然后使用ID更新
UPDATE users SET github_id = '12345678' WHERE id = <查询到的ID>;
*/

-- 方案C：批量生成更新语句
-- 下面的查询会生成所有需要更新的SQL语句
/*
SELECT CONCAT(
    '-- 用户: ', username, ' (ID: ', id, ') | 旧GitHub ID: ', github_id,
    ' | 请访问: https://api.github.com/users/', github_id,
    ' | 然后执行: UPDATE users SET github_id = ''<数字ID>'' WHERE id = ', id, ';'
) as migration_instructions
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND github_id NOT REGEXP '^[0-9]+$'  -- 只处理非纯数字的github_id
  AND deleted_at IS NULL
ORDER BY id;
*/

-- ===================================================================
-- 步骤4：验证迁移结果
-- ===================================================================
-- 检查是否所有github_id都已更新为数字格式

-- MySQL/MariaDB 版本
/*
SELECT
    id,
    username,
    github_id,
    CASE
        WHEN github_id REGEXP '^[0-9]+$' THEN '✓ 已迁移'
        ELSE '✗ 未迁移'
    END as migration_status,
    email
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL
ORDER BY id;
*/

-- PostgreSQL 版本
/*
SELECT
    id,
    username,
    github_id,
    CASE
        WHEN github_id ~ '^[0-9]+$' THEN '✓ 已迁移'
        ELSE '✗ 未迁移'
    END as migration_status,
    email
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL
ORDER BY id;
*/

-- SQLite 版本
/*
SELECT
    id,
    username,
    github_id,
    CASE
        WHEN github_id GLOB '*[0-9]*' AND github_id NOT GLOB '*[a-zA-Z]*' THEN '✓ 已迁移'
        ELSE '✗ 未迁移'
    END as migration_status,
    email
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL
ORDER BY id;
*/

-- ===================================================================
-- 步骤5：统计迁移结果
-- ===================================================================

-- MySQL/MariaDB 版本
/*
SELECT
    COUNT(CASE WHEN github_id REGEXP '^[0-9]+$' THEN 1 END) as migrated_count,
    COUNT(CASE WHEN github_id NOT REGEXP '^[0-9]+$' THEN 1 END) as pending_count,
    COUNT(*) as total_count
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL;
*/

-- PostgreSQL 版本
/*
SELECT
    COUNT(CASE WHEN github_id ~ '^[0-9]+$' THEN 1 END) as migrated_count,
    COUNT(CASE WHEN github_id !~ '^[0-9]+$' THEN 1 END) as pending_count,
    COUNT(*) as total_count
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL;
*/

-- SQLite 版本
/*
SELECT
    COUNT(CASE WHEN github_id GLOB '*[0-9]*' AND github_id NOT GLOB '*[a-zA-Z]*' THEN 1 END) as migrated_count,
    COUNT(CASE WHEN NOT (github_id GLOB '*[0-9]*' AND github_id NOT GLOB '*[a-zA-Z]*') THEN 1 END) as pending_count,
    COUNT(*) as total_count
FROM users
WHERE github_id IS NOT NULL
  AND github_id != ''
  AND deleted_at IS NULL;
*/

-- ===================================================================
-- 回滚方案（如果出现问题）
-- ===================================================================
-- 如果迁移后出现严重问题，可以从备份恢复数据库：
--
-- MySQL:
--   mysql -u root -p new_api < backup_before_migration_YYYYMMDD_HHMMSS.sql
--
-- PostgreSQL:
--   psql new_api < backup_before_migration_YYYYMMDD_HHMMSS.sql
--
-- SQLite:
--   cp backup_before_migration_YYYYMMDD_HHMMSS.db new-api.db

-- ===================================================================
-- 注意事项
-- ===================================================================
--
-- 1. 迁移过程中，用户可能无法登录（短暂时间）
-- 2. 建议在低峰期执行迁移
-- 3. 迁移完成后，所有用户仍可正常登录
-- 4. GitHub数字ID是永久的，不会因为用户名变更而改变
-- 5. 迁移是幂等的，可以安全地重复执行
--
-- ===================================================================
