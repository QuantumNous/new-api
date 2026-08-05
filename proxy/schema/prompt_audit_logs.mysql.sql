-- prompt_audit_logs — MySQL schema for the proxy sidecar.
--
-- Use this when the proxy must not run DDL itself, which is the normal rule for a
-- shared production database. Create the table with this script, then set
-- `database.auto_migrate: false` in the proxy config; it will verify the table
-- exists at startup and fail fast if it does not.
--
-- This DDL was exported with SHOW CREATE TABLE from a table GORM had created, so
-- it matches what AutoMigrate produces exactly — AutoMigrate will not try to alter
-- it afterwards. It was generated on MySQL 8.0.
--
-- Least-privilege account for the proxy (adjust the host pattern):
--
--   CREATE USER 'proxy'@'%' IDENTIFIED BY '<password>';
--   GRANT INSERT, SELECT ON `new-api`.`prompt_audit_logs` TO 'proxy'@'%';
--   -- only needed while identity.enabled is true:
--   GRANT SELECT ON `new-api`.`tokens` TO 'proxy'@'%';
--   GRANT SELECT ON `new-api`.`users`  TO 'proxy'@'%';
--
-- Retention: this table grows with every audited request and nothing prunes it.
-- Schedule a cleanup, for example:
--
--   DELETE FROM `prompt_audit_logs`
--    WHERE `created_at` < UNIX_TIMESTAMP(NOW() - INTERVAL 90 DAY)
--    LIMIT 10000;   -- repeat until zero rows affected

CREATE TABLE IF NOT EXISTS `prompt_audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  -- Unix timestamp in seconds, matching new-api's logs.created_at.
  `created_at` bigint DEFAULT NULL,
  -- new-api's own request id, read back from its X-Oneapi-Request-Id response
  -- header. Join against logs.request_id.
  `request_id` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `method` varchar(8) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `path` varchar(256) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_stream` tinyint(1) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `username` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `token_id` bigint DEFAULT NULL,
  `token_name` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `token_group` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `client_ip` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  -- TEXT holds 65535 bytes; the proxy caps writes at 60000 bytes so an oversized
  -- prompt can never fail its insert.
  `prompt_text` text COLLATE utf8mb4_general_ci,
  `raw_body` text COLLATE utf8mb4_general_ci,
  -- Set when the request body exceeded capture.max_body_bytes, so the captured
  -- content is a prefix and prompt extraction may have failed.
  `truncated` tinyint(1) DEFAULT NULL,
  `body_bytes` bigint DEFAULT NULL,
  `status_code` bigint DEFAULT NULL,
  -- Time to first byte, not total duration: the record is written when the
  -- upstream response headers arrive, because a streaming relay can stay open far
  -- longer than the audit may wait.
  `latency_ms` bigint DEFAULT NULL,
  `node` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pal_created_at` (`created_at`),
  KEY `idx_pal_request_id` (`request_id`),
  KEY `idx_pal_model` (`model`),
  KEY `idx_pal_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
