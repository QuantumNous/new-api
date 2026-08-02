-- P2 token-group visibility rollback (MySQL)
-- Destructive: run only on a disposable backup-copy drill after exporting rows.
DROP TABLE IF EXISTS `token_group_visibility_targets`;
DROP TABLE IF EXISTS `token_group_visibilities`;
