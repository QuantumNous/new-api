-- P2 token-group visibility schema (MySQL >= 5.7.8)
-- Run only against a verified backup copy during release preparation.
-- The application keeps TOKEN_GROUP_VISIBILITY_ENABLED=false until acceptance.

CREATE TABLE IF NOT EXISTS `token_group_visibilities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group` varchar(64) NOT NULL,
  `visibility` varchar(16) NOT NULL,
  `start_time` bigint NOT NULL DEFAULT 0,
  `end_time` bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_token_group_visibilities_group` (`group`),
  KEY `idx_token_group_visibilities_visibility` (`visibility`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `token_group_visibility_targets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `visibility_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_token_group_visibility_targets_visibility_id` (`visibility_id`),
  KEY `idx_token_group_visibility_targets_user_id` (`user_id`),
  UNIQUE KEY `idx_visibility_user` (`visibility_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
