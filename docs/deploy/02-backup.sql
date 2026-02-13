-- ============================================================
-- 数据备份 SQL（全量）
-- 功能：上线前在线上数据库中执行，备份所有业务表
-- 日期：2026-02-13
-- 说明：通过 CREATE TABLE AS 方式在库内创建备份表
-- ============================================================

-- ============================================================
-- 一、全量备份（所有业务表）
-- ============================================================

CREATE TABLE IF NOT EXISTS abilities_backup_20260213 AS SELECT * FROM abilities;
CREATE TABLE IF NOT EXISTS channels_backup_20260213 AS SELECT * FROM channels;
CREATE TABLE IF NOT EXISTS checkins_backup_20260213 AS SELECT * FROM checkins;
CREATE TABLE IF NOT EXISTS custom_oauth_providers_backup_20260213 AS SELECT * FROM custom_oauth_providers;
CREATE TABLE IF NOT EXISTS logs_backup_20260213 AS SELECT * FROM logs;
CREATE TABLE IF NOT EXISTS midjourneys_backup_20260213 AS SELECT * FROM midjourneys;
CREATE TABLE IF NOT EXISTS models_backup_20260213 AS SELECT * FROM models;
CREATE TABLE IF NOT EXISTS options_backup_20260213 AS SELECT * FROM options;
CREATE TABLE IF NOT EXISTS passkey_credentials_backup_20260213 AS SELECT * FROM passkey_credentials;
CREATE TABLE IF NOT EXISTS prefill_groups_backup_20260213 AS SELECT * FROM prefill_groups;
CREATE TABLE IF NOT EXISTS quota_data_backup_20260213 AS SELECT * FROM quota_data;
CREATE TABLE IF NOT EXISTS redemptions_backup_20260213 AS SELECT * FROM redemptions;
CREATE TABLE IF NOT EXISTS setups_backup_20260213 AS SELECT * FROM setups;
CREATE TABLE IF NOT EXISTS subscription_orders_backup_20260213 AS SELECT * FROM subscription_orders;
CREATE TABLE IF NOT EXISTS subscription_plans_backup_20260213 AS SELECT * FROM subscription_plans;
CREATE TABLE IF NOT EXISTS subscription_pre_consume_records_backup_20260213 AS SELECT * FROM subscription_pre_consume_records;
CREATE TABLE IF NOT EXISTS tasks_backup_20260213 AS SELECT * FROM tasks;
CREATE TABLE IF NOT EXISTS tokens_backup_20260213 AS SELECT * FROM tokens;
CREATE TABLE IF NOT EXISTS top_ups_backup_20260213 AS SELECT * FROM top_ups;
CREATE TABLE IF NOT EXISTS two_fa_backup_codes_backup_20260213 AS SELECT * FROM two_fa_backup_codes;
CREATE TABLE IF NOT EXISTS two_fas_backup_20260213 AS SELECT * FROM two_fas;
CREATE TABLE IF NOT EXISTS user_oauth_bindings_backup_20260213 AS SELECT * FROM user_oauth_bindings;
CREATE TABLE IF NOT EXISTS user_subscriptions_backup_20260213 AS SELECT * FROM user_subscriptions;
CREATE TABLE IF NOT EXISTS users_backup_20260213 AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS vendors_backup_20260213 AS SELECT * FROM vendors;


-- ============================================================
-- 二、验证备份数据（逐表对比行数）
-- ============================================================

SELECT 'abilities' AS tbl, (SELECT count(*) FROM abilities) AS src, (SELECT count(*) FROM abilities_backup_20260213) AS bak
UNION ALL SELECT 'channels', (SELECT count(*) FROM channels), (SELECT count(*) FROM channels_backup_20260213)
UNION ALL SELECT 'checkins', (SELECT count(*) FROM checkins), (SELECT count(*) FROM checkins_backup_20260213)
UNION ALL SELECT 'custom_oauth_providers', (SELECT count(*) FROM custom_oauth_providers), (SELECT count(*) FROM custom_oauth_providers_backup_20260213)
UNION ALL SELECT 'logs', (SELECT count(*) FROM logs), (SELECT count(*) FROM logs_backup_20260213)
UNION ALL SELECT 'midjourneys', (SELECT count(*) FROM midjourneys), (SELECT count(*) FROM midjourneys_backup_20260213)
UNION ALL SELECT 'models', (SELECT count(*) FROM models), (SELECT count(*) FROM models_backup_20260213)
UNION ALL SELECT 'options', (SELECT count(*) FROM options), (SELECT count(*) FROM options_backup_20260213)
UNION ALL SELECT 'passkey_credentials', (SELECT count(*) FROM passkey_credentials), (SELECT count(*) FROM passkey_credentials_backup_20260213)
UNION ALL SELECT 'prefill_groups', (SELECT count(*) FROM prefill_groups), (SELECT count(*) FROM prefill_groups_backup_20260213)
UNION ALL SELECT 'quota_data', (SELECT count(*) FROM quota_data), (SELECT count(*) FROM quota_data_backup_20260213)
UNION ALL SELECT 'redemptions', (SELECT count(*) FROM redemptions), (SELECT count(*) FROM redemptions_backup_20260213)
UNION ALL SELECT 'setups', (SELECT count(*) FROM setups), (SELECT count(*) FROM setups_backup_20260213)
UNION ALL SELECT 'subscription_orders', (SELECT count(*) FROM subscription_orders), (SELECT count(*) FROM subscription_orders_backup_20260213)
UNION ALL SELECT 'subscription_plans', (SELECT count(*) FROM subscription_plans), (SELECT count(*) FROM subscription_plans_backup_20260213)
UNION ALL SELECT 'subscription_pre_consume_records', (SELECT count(*) FROM subscription_pre_consume_records), (SELECT count(*) FROM subscription_pre_consume_records_backup_20260213)
UNION ALL SELECT 'tasks', (SELECT count(*) FROM tasks), (SELECT count(*) FROM tasks_backup_20260213)
UNION ALL SELECT 'tokens', (SELECT count(*) FROM tokens), (SELECT count(*) FROM tokens_backup_20260213)
UNION ALL SELECT 'top_ups', (SELECT count(*) FROM top_ups), (SELECT count(*) FROM top_ups_backup_20260213)
UNION ALL SELECT 'two_fa_backup_codes', (SELECT count(*) FROM two_fa_backup_codes), (SELECT count(*) FROM two_fa_backup_codes_backup_20260213)
UNION ALL SELECT 'two_fas', (SELECT count(*) FROM two_fas), (SELECT count(*) FROM two_fas_backup_20260213)
UNION ALL SELECT 'user_oauth_bindings', (SELECT count(*) FROM user_oauth_bindings), (SELECT count(*) FROM user_oauth_bindings_backup_20260213)
UNION ALL SELECT 'user_subscriptions', (SELECT count(*) FROM user_subscriptions), (SELECT count(*) FROM user_subscriptions_backup_20260213)
UNION ALL SELECT 'users', (SELECT count(*) FROM users), (SELECT count(*) FROM users_backup_20260213)
UNION ALL SELECT 'vendors', (SELECT count(*) FROM vendors), (SELECT count(*) FROM vendors_backup_20260213);


-- ============================================================
-- 三、清理全量备份表（上线稳定后执行）
-- ============================================================

-- DROP TABLE IF EXISTS abilities_backup_20260213;
-- DROP TABLE IF EXISTS channels_backup_20260213;
-- DROP TABLE IF EXISTS checkins_backup_20260213;
-- DROP TABLE IF EXISTS custom_oauth_providers_backup_20260213;
-- DROP TABLE IF EXISTS logs_backup_20260213;
-- DROP TABLE IF EXISTS midjourneys_backup_20260213;
-- DROP TABLE IF EXISTS models_backup_20260213;
-- DROP TABLE IF EXISTS options_backup_20260213;
-- DROP TABLE IF EXISTS passkey_credentials_backup_20260213;
-- DROP TABLE IF EXISTS prefill_groups_backup_20260213;
-- DROP TABLE IF EXISTS quota_data_backup_20260213;
-- DROP TABLE IF EXISTS redemptions_backup_20260213;
-- DROP TABLE IF EXISTS setups_backup_20260213;
-- DROP TABLE IF EXISTS subscription_orders_backup_20260213;
-- DROP TABLE IF EXISTS subscription_plans_backup_20260213;
-- DROP TABLE IF EXISTS subscription_pre_consume_records_backup_20260213;
-- DROP TABLE IF EXISTS tasks_backup_20260213;
-- DROP TABLE IF EXISTS tokens_backup_20260213;
-- DROP TABLE IF EXISTS top_ups_backup_20260213;
-- DROP TABLE IF EXISTS two_fa_backup_codes_backup_20260213;
-- DROP TABLE IF EXISTS two_fas_backup_20260213;
-- DROP TABLE IF EXISTS user_oauth_bindings_backup_20260213;
-- DROP TABLE IF EXISTS user_subscriptions_backup_20260213;
-- DROP TABLE IF EXISTS users_backup_20260213;
-- DROP TABLE IF EXISTS vendors_backup_20260213;
