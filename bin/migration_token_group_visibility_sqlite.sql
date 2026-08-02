-- P2 token-group visibility schema (SQLite)
-- Run only against a verified backup copy during release preparation.
-- The application keeps TOKEN_GROUP_VISIBILITY_ENABLED=false until acceptance.

CREATE TABLE IF NOT EXISTS "token_group_visibilities" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "group" varchar(64) NOT NULL,
  "visibility" varchar(16) NOT NULL,
  "start_time" bigint NOT NULL DEFAULT 0,
  "end_time" bigint NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "uni_token_group_visibilities_group"
  ON "token_group_visibilities" ("group");
CREATE INDEX IF NOT EXISTS "idx_token_group_visibilities_visibility"
  ON "token_group_visibilities" ("visibility");

CREATE TABLE IF NOT EXISTS "token_group_visibility_targets" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "visibility_id" bigint NOT NULL,
  "username" varchar(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_token_group_visibility_targets_visibility_id"
  ON "token_group_visibility_targets" ("visibility_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_visibility_username"
  ON "token_group_visibility_targets" ("visibility_id", "username");
