-- CC Switch import schema package for MySQL 5.7.8+.
-- Generated for the new-api CC Switch one-click import feature.

CREATE TABLE IF NOT EXISTS `ccswitch_import_logs` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` bigint,
    `token_id` bigint,
    `target` varchar(64),
    `model` varchar(255),
    `created_at` bigint,
    `ip` varchar(64),
    `user_agent` varchar(512),
    PRIMARY KEY (`id`),
    KEY `idx_ccswitch_import_logs_user_id` (`user_id`),
    KEY `idx_ccswitch_import_logs_token_id` (`token_id`),
    KEY `idx_ccswitch_import_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_ccswitch_preferences` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` bigint,
    `last_target` varchar(64),
    `last_model` varchar(255),
    `updated_at` bigint,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_user_ccswitch_preferences_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing business dependency reference only.
-- Do not recreate this table in a production database that already has tokens.
CREATE TABLE IF NOT EXISTS `tokens` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` bigint,
    `key` varchar(128),
    `status` bigint DEFAULT 1,
    `name` varchar(191),
    `created_time` bigint,
    `accessed_time` bigint,
    `expired_time` bigint DEFAULT -1,
    `remain_quota` bigint DEFAULT 0,
    `unlimited_quota` tinyint(1),
    `model_limits_enabled` tinyint(1),
    `model_limits` text,
    `allow_ips` text,
    `used_quota` bigint DEFAULT 0,
    `group` varchar(191) DEFAULT '',
    `cross_group_retry` tinyint(1),
    `deleted_at` datetime(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_tokens_key` (`key`),
    KEY `idx_tokens_user_id` (`user_id`),
    KEY `idx_tokens_name` (`name`),
    KEY `idx_tokens_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing tokens migration note:
-- token key must be varchar(128). Legacy char(48) deployments should be migrated
-- by the project's GORM migration path, not by dropping or recreating tokens.

