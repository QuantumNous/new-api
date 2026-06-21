package skillmodel

import (
	"fmt"

	"gorm.io/gorm"
)

const sueEventTypeCheckExpr = "event_type IN ('skill_impression','skill_detail_view','skill_saved','skill_favorited','skill_enabled','skill_rated','skill_reported','skill_evaluation_completed','skill_admin_action','skill_kids_approved','skill_installed','skill_used_local','skill_used','skill_blocked','skill_first_use','skill_repeat_use')"
const sueEntryPointCheckExpr = "entry_point IN ('marketplace_card','skill_detail','my_skills','saved_list','playground_picker','featured','popular','new','recommended','admin_preview','search_results','skill_package')"
const suePlanCheckExpr = "plan IS NULL OR plan IN ('free','pro','enterprise')"
const sueBlockReasonCheckExpr = "block_reason IS NULL OR block_reason IN ('auth_required','skill_not_found','skill_not_published','skill_not_enabled','plan_required','subscription_inactive','evaluation_not_passed','quota_exceeded','kids_mode_blocked','context_too_long','rate_limited','timeout','safety_violation','internal_error')"
// sueKidsPrivacyCheckExpr requires that Kids session events carry neither user_id
// nor tenant_id (V1: tenant_id == user_id, so either field persists the child's
// real identifier). A non-empty session_id (HMAC pseudo-ID) is mandatory instead.
const sueKidsPrivacyCheckExpr = "is_kids_session = false OR (user_id IS NULL AND tenant_id IS NULL AND session_id IS NOT NULL AND session_id <> '')"

// sueRestrictedMetadataJSONPaths lists the top-level JSON paths checked by the DB
// metadata constraint (chk_sue_metadata_no_restricted_keys). DB CHECK constraints
// can only inspect top-level JSON keys — nested restricted keys (e.g.
// {"safe":{"prompt":"..."}}) bypass the DB check. The application write path
// (validateSUEEventMetadata / jsonContainsRestrictedMetadataKey) is the authoritative
// recursive guard and always runs before the DB constraint via BeforeCreate.
const sueRestrictedMetadataJSONPaths = "'$.instruction_template', '$.prompt', '$.system_prompt', '$.raw_messages', '$.provider_payload', '$.kids_raw_input', '$.full_user_input', '$.raw_output', '$.model_output'"

// MigrateSkillUsageEvents creates and configures the skill_usage_events table.
//
// SQLite path: CREATE TABLE IF NOT EXISTS with all columns, then createSUEIndexes.
// PG/MySQL path: AutoMigrate → createSUEIndexes.
//
// occurred_at has no DB-level DEFAULT — it is always set from Go (time.Now().UTC()).
// No FK on skill_id/skill_version_id: skill_usage_events is an append-only event log;
// hard deletes on skills must not cascade-delete audit history (tasks/03 §4.4).
func MigrateSkillUsageEvents(db *gorm.DB) error {
	if db.Dialector.Name() == "sqlite" {
		return migrateSkillUsageEventsSQLite(db)
	}
	if err := db.AutoMigrate(&SkillUsageEvent{}); err != nil {
		return fmt.Errorf("AutoMigrate SkillUsageEvent: %w", err)
	}
	if err := createSUEJSONBColumns(db); err != nil {
		return err
	}
	if err := migrateSUEConstraints(db); err != nil {
		return err
	}
	return createSUEIndexes(db)
}

func migrateSkillUsageEventsSQLite(db *gorm.DB) error {
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS "skill_usage_events" (
			"event_id"                TEXT     NOT NULL,
			"event_type"              TEXT     NOT NULL,
			"occurred_at"             DATETIME NOT NULL,
			"user_id"                 INTEGER,
			"tenant_id"               INTEGER,
			"session_id"              TEXT,
			"request_id"              TEXT,
			"skill_id"                TEXT,
			"skill_version_id"        TEXT,
			"entry_point"             TEXT     NOT NULL,
			"plan"                    TEXT,
			"subscription_status"     TEXT,
			"persona"                 TEXT,
			"persona_source"          TEXT,
			"model"                   TEXT,
			"is_kids_session"         INTEGER  NOT NULL DEFAULT 0,
			"is_kids_safe_skill"      INTEGER,
			"is_kids_exclusive_skill" INTEGER,
			"input_tokens"            INTEGER,
			"output_tokens"           INTEGER,
			"total_tokens"            INTEGER,
			"latency_ms"              INTEGER,
			"success"                 INTEGER,
			"failure_reason"          TEXT,
			"block_reason"            TEXT,
			"error_code"              TEXT,
			"timeout_occurred"        INTEGER  NOT NULL DEFAULT 0,
			"prompt_injection_detected" INTEGER NOT NULL DEFAULT 0,
			"safety_violation_detected" INTEGER NOT NULL DEFAULT 0,
			"metadata"                TEXT     NOT NULL DEFAULT '{}',
			PRIMARY KEY ("event_id"),
			CONSTRAINT "chk_sue_input_tokens" CHECK ("input_tokens" IS NULL OR "input_tokens" >= 0),
			CONSTRAINT "chk_sue_output_tokens" CHECK ("output_tokens" IS NULL OR "output_tokens" >= 0),
			CONSTRAINT "chk_sue_total_tokens" CHECK ("total_tokens" IS NULL OR "total_tokens" >= 0),
			CONSTRAINT "chk_sue_latency_ms" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0),
			CONSTRAINT "chk_sue_event_type" CHECK (` + sueEventTypeCheckExpr + `),
			CONSTRAINT "chk_sue_entry_point" CHECK (` + sueEntryPointCheckExpr + `),
			CONSTRAINT "chk_sue_plan" CHECK (` + suePlanCheckExpr + `),
			CONSTRAINT "chk_sue_block_reason" CHECK (` + sueBlockReasonCheckExpr + `),
			CONSTRAINT "chk_sue_kids_privacy" CHECK (` + sueKidsPrivacyCheckExpr + `),
			CONSTRAINT "chk_sue_metadata_object" CHECK (json_valid("metadata") AND json_type("metadata") = 'object'),
			-- top-level keys only; nested restricted keys require the application BeforeCreate guard
			CONSTRAINT "chk_sue_metadata_no_restricted_keys" CHECK (
				json_extract("metadata", '$.instruction_template') IS NULL AND
				json_extract("metadata", '$.prompt') IS NULL AND
				json_extract("metadata", '$.system_prompt') IS NULL AND
				json_extract("metadata", '$.raw_messages') IS NULL AND
				json_extract("metadata", '$.provider_payload') IS NULL AND
				json_extract("metadata", '$.kids_raw_input') IS NULL AND
				json_extract("metadata", '$.full_user_input') IS NULL AND
				json_extract("metadata", '$.raw_output') IS NULL AND
				json_extract("metadata", '$.model_output') IS NULL
			)
		)`).Error; err != nil {
		return fmt.Errorf("create skill_usage_events (SQLite): %w", err)
	}
	return createSUEIndexes(db)
}

func migrateSUEConstraints(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		// proceed
	case "mysql":
		ok, err := isMySQLAtLeast8016DB(db)
		if err != nil {
			return fmt.Errorf("detect mysql version for skill_usage_events CHECK constraints: %w", err)
		}
		if !ok {
			return nil
		}
	default:
		return nil
	}

	constraints := []struct {
		name string
		expr string
	}{
		{"chk_sue_event_type", sueEventTypeCheckExpr},
		{"chk_sue_entry_point", sueEntryPointCheckExpr},
		{"chk_sue_plan", suePlanCheckExpr},
		{"chk_sue_block_reason", sueBlockReasonCheckExpr},
		{"chk_sue_kids_privacy", sueKidsPrivacyCheckExpr},
		{"chk_sue_input_tokens", "input_tokens IS NULL OR input_tokens >= 0"},
		{"chk_sue_output_tokens", "output_tokens IS NULL OR output_tokens >= 0"},
		{"chk_sue_total_tokens", "total_tokens IS NULL OR total_tokens >= 0"},
		{"chk_sue_latency_ms", "latency_ms IS NULL OR latency_ms >= 0"},
	}
	for _, c := range constraints {
		if db.Migrator().HasConstraint(&SkillUsageEvent{}, c.name) {
			continue
		}
		sql := fmt.Sprintf("ALTER TABLE skill_usage_events ADD CONSTRAINT %s CHECK (%s)", c.name, c.expr)
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("add skill_usage_events constraint %s: %w", c.name, err)
		}
	}

	metadataConstraints := []struct {
		name string
		expr string
	}{}
	switch db.Dialector.Name() {
	case "postgres":
		metadataConstraints = []struct {
			name string
			expr string
		}{
			{"chk_sue_metadata_object", "jsonb_typeof(metadata::jsonb) = 'object'"},
			{"chk_sue_metadata_no_restricted_keys", "NOT (metadata::jsonb ?| array['instruction_template','prompt','system_prompt','raw_messages','provider_payload','kids_raw_input','full_user_input','raw_output','model_output'])"},
		}
	case "mysql":
		metadataConstraints = []struct {
			name string
			expr string
		}{
			{"chk_sue_metadata_object", "CASE WHEN JSON_VALID(metadata) THEN JSON_TYPE(metadata) = 'OBJECT' ELSE FALSE END"},
			{"chk_sue_metadata_no_restricted_keys", "CASE WHEN JSON_VALID(metadata) THEN NOT JSON_CONTAINS_PATH(metadata, 'one', " + sueRestrictedMetadataJSONPaths + ") ELSE FALSE END"},
		}
	}
	for _, c := range metadataConstraints {
		if db.Migrator().HasConstraint(&SkillUsageEvent{}, c.name) {
			continue
		}
		sql := fmt.Sprintf("ALTER TABLE skill_usage_events ADD CONSTRAINT %s CHECK (%s)", c.name, c.expr)
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("add skill_usage_events constraint %s: %w", c.name, err)
		}
	}
	return nil
}

func createSUEJSONBColumns(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}
	already, err := isPGColumnJSONB(db, "skill_usage_events", "metadata")
	if err != nil {
		return fmt.Errorf("check skill_usage_events metadata jsonb: %w", err)
	}
	if already {
		return nil
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for _, sql := range []string{
			"ALTER TABLE skill_usage_events ALTER COLUMN metadata DROP DEFAULT",
			"ALTER TABLE skill_usage_events ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb",
			"ALTER TABLE skill_usage_events ALTER COLUMN metadata SET DEFAULT '{}'::jsonb",
		} {
			if err := tx.Exec(sql).Error; err != nil {
				return fmt.Errorf("skill_usage_events metadata jsonb upgrade: %w", err)
			}
		}
		return nil
	})
}

// createSUEIndexes creates query indexes for skill_usage_events.
// Uses HasIndex + Exec for cross-DB idempotency (MySQL 5.7 lacks CREATE INDEX IF NOT EXISTS).
func createSUEIndexes(db *gorm.DB) error {
	indexes := []struct{ name, ddl string }{
		{
			"idx_sue_event_time",
			"CREATE INDEX idx_sue_event_time ON skill_usage_events(event_type, occurred_at)",
		},
		{
			"idx_sue_user_skill",
			"CREATE INDEX idx_sue_user_skill ON skill_usage_events(user_id, skill_id, occurred_at)",
		},
		{
			"idx_sue_entry_time",
			"CREATE INDEX idx_sue_entry_time ON skill_usage_events(entry_point, occurred_at)",
		},
		{
			"idx_usage_skill_time",
			"CREATE INDEX idx_usage_skill_time ON skill_usage_events(skill_id, occurred_at)",
		},
		{
			"idx_usage_user_time",
			"CREATE INDEX idx_usage_user_time ON skill_usage_events(user_id, occurred_at)",
		},
		{
			"idx_usage_plan_persona_time",
			"CREATE INDEX idx_usage_plan_persona_time ON skill_usage_events(plan, persona, occurred_at)",
		},
		{
			"idx_usage_request_id",
			"CREATE INDEX idx_usage_request_id ON skill_usage_events(request_id)",
		},
	}
	for _, idx := range indexes {
		if !db.Migrator().HasIndex(&SkillUsageEvent{}, idx.name) {
			if err := db.Exec(idx.ddl).Error; err != nil {
				return fmt.Errorf("create index %s: %w", idx.name, err)
			}
		}
	}
	return nil
}
