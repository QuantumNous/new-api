-- P2 token-group visibility schema (PostgreSQL >= 9.6)
-- Run only against a verified backup copy during release preparation.
-- The application keeps TOKEN_GROUP_VISIBILITY_ENABLED=false until acceptance.

CREATE TABLE IF NOT EXISTS "token_group_visibilities" (
  "id" bigserial PRIMARY KEY,
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
  "id" bigserial PRIMARY KEY,
  "visibility_id" bigint NOT NULL,
  "user_id" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_token_group_visibility_targets_visibility_id"
  ON "token_group_visibility_targets" ("visibility_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_visibility_user"
  ON "token_group_visibility_targets" ("visibility_id", "user_id");
