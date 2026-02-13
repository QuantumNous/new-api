-- ============================================================
-- 本次发布 DDL 变更
-- 功能：兑换码支持订阅套餐类型
-- 日期：2026-02-13
-- ============================================================

-- 说明：GORM AutoMigrate 会在应用启动时自动执行以下变更。
-- 如果需要手动执行（例如 DBA 审核后手动上线），请使用以下 SQL。

-- ============================================================
-- 1. redemptions 表新增字段
-- ============================================================

-- 1.1 新增 type 字段：兑换码类型（1=余额充值, 2=订阅套餐）
-- PostgreSQL:
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS type bigint DEFAULT 1;

-- MySQL:
-- ALTER TABLE redemptions ADD COLUMN `type` int DEFAULT 1;

-- SQLite:
-- ALTER TABLE redemptions ADD COLUMN type integer DEFAULT 1;


-- 1.2 新增 subscription_plan_id 字段：关联的订阅套餐ID，仅当 type=2 时有效
-- PostgreSQL:
ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS subscription_plan_id bigint DEFAULT 0;

-- MySQL:
-- ALTER TABLE redemptions ADD COLUMN `subscription_plan_id` int DEFAULT 0;

-- SQLite:
-- ALTER TABLE redemptions ADD COLUMN subscription_plan_id integer DEFAULT 0;


-- ============================================================
-- 2. 变更汇总
-- ============================================================
-- | 表名         | 字段                 | 类型    | 默认值 | 说明                          |
-- |-------------|---------------------|---------|--------|-------------------------------|
-- | redemptions | type                | bigint  | 1      | 1=余额充值, 2=订阅套餐          |
-- | redemptions | subscription_plan_id| bigint  | 0      | 订阅套餐ID，type=2 时有效        |

-- ============================================================
-- 3. 回滚 SQL（如需回滚）
-- ============================================================
-- PostgreSQL:
-- ALTER TABLE redemptions DROP COLUMN IF EXISTS type;
-- ALTER TABLE redemptions DROP COLUMN IF EXISTS subscription_plan_id;

-- MySQL:
-- ALTER TABLE redemptions DROP COLUMN `type`;
-- ALTER TABLE redemptions DROP COLUMN `subscription_plan_id`;
