package skillmodel

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const sueEventTypeCheckExpr = "event_type IN ('skill_impression','skill_detail_view','skill_saved','skill_unsaved','skill_favorited','skill_enabled','skill_rated','skill_reported','skill_evaluation_completed','skill_admin_action','skill_kids_approved','skill_installed','skill_used_local','skill_used','skill_blocked','skill_first_use','skill_repeat_use','skill_purchased')"
const sueEntryPointCheckExpr = "entry_point IN ('marketplace_card','skill_detail','my_skills','saved_list','playground_picker','featured','popular','new','new_week','trending','recommended','reco_personal','reco_codownload','admin_preview','search_results','skill_package','api_token','downloaded_runner')"
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

// sueAllDR43Columns lists every column in the DR-43 skill_usage_events schema in
// declaration order. rebuildSUETableSQLite uses this list to determine which columns
// from the old table carry over into the rebuilt table; columns absent from the old
// table receive their DR-43 DEFAULT on INSERT.
var sueAllDR43Columns = []string{
	"event_id", "event_type", "occurred_at",
	"user_id", "tenant_id", "session_id", "request_id",
	"skill_id", "skill_version_id", "first_use_key",
	"entry_point", "plan", "subscription_status",
	"persona", "persona_source", "model",
	"is_kids_session", "is_kids_safe_skill", "is_kids_exclusive_skill",
	"input_tokens", "output_tokens", "total_tokens", "latency_ms",
	"success", "failure_reason", "block_reason", "error_code",
	"timeout_occurred", "prompt_injection_detected", "safety_violation_detected",
	"metadata",
}

// sueCreateTableDDL returns the CREATE TABLE DDL for the full DR-43
// skill_usage_events schema. tableName must be either "skill_usage_events"
// (normal path) or "skill_usage_events_new" (rebuild temp table).
// IF NOT EXISTS is intentionally absent — callers verify existence themselves.
func sueCreateTableDDL(tableName string) string {
	return `CREATE TABLE "` + tableName + `" (
		"event_id"                TEXT     NOT NULL,
		"event_type"              TEXT     NOT NULL,
		"occurred_at"             DATETIME NOT NULL,
		"user_id"                 INTEGER,
		"tenant_id"               INTEGER,
		"session_id"              TEXT,
		"request_id"              TEXT,
		"skill_id"                TEXT,
		"skill_version_id"        TEXT,
		"first_use_key"           VARCHAR(128),
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
	)`
}

// MigrateSkillUsageEvents creates and configures the skill_usage_events table.
//
// SQLite fresh path: CREATE TABLE with full DR-43 schema (columns + CHECK constraints) →
//
//	createSUEIndexes.
//
// SQLite upgrade path (existing table): upgradeSUETableSQLite detects pre-DR-43
//
//	tables (missing chk_sue_kids_privacy) and rebuilds the table to add missing
//	DR-43 columns and CHECK constraints. SQLite cannot ADD CONSTRAINT via ALTER TABLE;
//	a full copy-rename rebuild is the only way to add constraints to an existing table.
//	The rebuild is wrapped in a transaction so an interrupted run leaves the original
//	table intact. Existing rows must conform to DR-43 CHECK constraints; rows written
//	via EmitSkillUsageEvent (the only sanctioned write path) always satisfy this
//	because BeforeCreate + EmitSkillUsageEvent enum guards enforce the same predicates.
//
// PG/MySQL path: AutoMigrate → createSUEJSONBColumns → migrateSUEConstraints → createSUEIndexes.
//
// occurred_at has no DB-level DEFAULT — it is always set from Go (time.Now().UTC()).
// No FK on skill_id/skill_version_id: skill_usage_events is an append-only event log;
// hard deletes on skills must not cascade-delete audit history (tasks/03 §4.4).
func MigrateSkillUsageEvents(db *gorm.DB) error {
	if db.Dialector.Name() == "sqlite" {
		return migrateSkillUsageEventsSQLite(db)
	}
	// PG idempotency: the SkillUsageEvent struct tags metadata as type:text, but
	// createSUEJSONBColumns (below) upgrades the column to jsonb. On subsequent runs
	// AutoMigrate sees the jsonb column and the type:text tag, and issues
	// ALTER COLUMN metadata TYPE text. PostgreSQL optimizes away the explicit ::jsonb
	// cast in the stored constraint expression (since the column was jsonb at add-time),
	// leaving jsonb_typeof(metadata) — which fails as "function jsonb_typeof(text)"
	// when the column type changes. Drop the jsonb-specific constraints before
	// AutoMigrate; migrateSUEConstraints re-adds them after createSUEJSONBColumns
	// upgrades the column back to jsonb.
	if db.Dialector.Name() == "postgres" && db.Migrator().HasTable(&SkillUsageEvent{}) {
		db.Exec("ALTER TABLE skill_usage_events DROP CONSTRAINT IF EXISTS chk_sue_metadata_object")
		db.Exec("ALTER TABLE skill_usage_events DROP CONSTRAINT IF EXISTS chk_sue_metadata_no_restricted_keys")
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
	if !db.Migrator().HasTable(&SkillUsageEvent{}) {
		if err := db.Exec(sueCreateTableDDL("skill_usage_events")).Error; err != nil {
			return fmt.Errorf("create skill_usage_events (SQLite): %w", err)
		}
	} else {
		if err := upgradeSUETableSQLite(db); err != nil {
			return err
		}
	}
	return createSUEIndexes(db)
}

// upgradeSUETableSQLite upgrades an existing skill_usage_events table to the DR-43
// schema. The presence of "chk_sue_kids_privacy" in the stored DDL is the sentinel:
// tables lacking it pre-date DR-43 and are rebuilt by rebuildSUETableSQLite.
// Tables already on the DR-43 schema are a no-op (idempotent).
func upgradeSUETableSQLite(db *gorm.DB) error {
	var ddl string
	if err := db.Raw(
		`SELECT sql FROM sqlite_master WHERE type='table' AND name='skill_usage_events'`,
	).Scan(&ddl).Error; err != nil {
		return fmt.Errorf("read skill_usage_events DDL for upgrade check: %w", err)
	}
	if strings.Contains(ddl, "chk_sue_kids_privacy") && strings.Contains(ddl, "skill_unsaved") && strings.Contains(ddl, "'new_week'") && strings.Contains(ddl, "'trending'") && strings.Contains(ddl, "'api_token'") && strings.Contains(ddl, "'downloaded_runner'") {
		if !db.Migrator().HasColumn(&SkillUsageEvent{}, "first_use_key") {
			if err := db.Exec(`ALTER TABLE "skill_usage_events" ADD COLUMN "first_use_key" VARCHAR(128)`).Error; err != nil {
				return fmt.Errorf("add skill_usage_events.first_use_key (SQLite): %w", err)
			}
		}
		return nil // already DR-43 schema: idempotent no-op beyond additive columns
	}
	return rebuildSUETableSQLite(db)
}

// rebuildSUETableSQLite upgrades a pre-DR-43 skill_usage_events table by:
//  1. Creating skill_usage_events_new with the full DR-43 schema (all columns +
//     CHECK constraints). SQLite cannot add CHECK constraints via ALTER TABLE.
//  2. Copying all rows from the old table; columns absent in the old schema
//     receive their DR-43 DEFAULT value (is_kids_session=0, metadata='{}', etc.).
//  3. Dropping the old table (cascades its indexes) and renaming the new one.
//
// All steps run in a single SQLite transaction: a failure rolls back to the original
// intact table. Rows that would violate DR-43 CHECK constraints cause the migration to
// fail with an explicit error — this indicates data corruption that must be resolved
// manually, since EmitSkillUsageEvent always enforces the same predicates at write time.
func rebuildSUETableSQLite(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Remove any stale temp table left by an interrupted previous run.
		if err := tx.Exec(`DROP TABLE IF EXISTS "skill_usage_events_new"`).Error; err != nil {
			return fmt.Errorf("drop stale skill_usage_events_new: %w", err)
		}
		if err := tx.Exec(sueCreateTableDDL("skill_usage_events_new")).Error; err != nil {
			return fmt.Errorf("create skill_usage_events_new (SQLite rebuild): %w", err)
		}

		// Discover which columns exist in the old table so we can build a safe
		// INSERT … SELECT that only references columns that actually exist.
		type colRow struct {
			Name string `gorm:"column:name"`
		}
		var colRows []colRow
		if err := tx.Raw("SELECT name FROM pragma_table_info('skill_usage_events')").Scan(&colRows).Error; err != nil {
			return fmt.Errorf("pragma_table_info skill_usage_events: %w", err)
		}
		oldColSet := make(map[string]bool, len(colRows))
		for _, c := range colRows {
			oldColSet[c.Name] = true
		}

		var quotedCols []string
		for _, c := range sueAllDR43Columns {
			if oldColSet[c] {
				quotedCols = append(quotedCols, `"`+c+`"`)
			}
		}
		if len(quotedCols) == 0 {
			return fmt.Errorf("rebuildSUETableSQLite: no DR-43 columns found in old skill_usage_events")
		}
		colList := strings.Join(quotedCols, ", ")
		insertSQL := `INSERT INTO "skill_usage_events_new" (` + colList + `) SELECT ` + colList + ` FROM "skill_usage_events"`
		if err := tx.Exec(insertSQL).Error; err != nil {
			return fmt.Errorf("copy skill_usage_events rows to DR-43 schema: %w", err)
		}

		if err := tx.Exec(`DROP TABLE "skill_usage_events"`).Error; err != nil {
			return fmt.Errorf("drop old skill_usage_events: %w", err)
		}
		if err := tx.Exec(`ALTER TABLE "skill_usage_events_new" RENAME TO "skill_usage_events"`).Error; err != nil {
			return fmt.Errorf("rename skill_usage_events_new to skill_usage_events: %w", err)
		}
		return nil
	})
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
	// DR-90 extends the entry-point enum. Existing PG/MySQL CHECK constraints
	// keep their old expression unless explicitly recreated.
	if db.Migrator().HasConstraint(&SkillUsageEvent{}, "chk_sue_entry_point") {
		if err := db.Migrator().DropConstraint(&SkillUsageEvent{}, "chk_sue_entry_point"); err != nil {
			return fmt.Errorf("drop stale skill_usage_events constraint chk_sue_entry_point: %w", err)
		}
	}
	for _, c := range constraints {
		if c.name == "chk_sue_event_type" {
			if err := refreshSUEEventTypeConstraint(db, c.name); err != nil {
				return err
			}
		}
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
		// MySQL 8.0.16+ rejects CASE WHEN expressions in CHECK constraints (Error 3812)
		// because CASE WHEN is not recognised as a boolean predicate. Use AND form:
		// JSON_VALID short-circuits to 0 for invalid JSON, rejecting it correctly.
		metadataConstraints = []struct {
			name string
			expr string
		}{
			{"chk_sue_metadata_object", "JSON_VALID(metadata) AND (JSON_TYPE(metadata) = 'OBJECT')"},
			{"chk_sue_metadata_no_restricted_keys", "JSON_VALID(metadata) AND NOT JSON_CONTAINS_PATH(metadata, 'one', " + sueRestrictedMetadataJSONPaths + ")"},
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

func refreshSUEEventTypeConstraint(db *gorm.DB, name string) error {
	if !db.Migrator().HasConstraint(&SkillUsageEvent{}, name) {
		return nil
	}
	switch db.Dialector.Name() {
	case "postgres":
		if err := db.Exec("ALTER TABLE skill_usage_events DROP CONSTRAINT IF EXISTS " + name).Error; err != nil {
			return fmt.Errorf("drop stale skill_usage_events constraint %s: %w", name, err)
		}
	case "mysql":
		if err := db.Exec("ALTER TABLE skill_usage_events DROP CHECK " + name).Error; err != nil {
			return fmt.Errorf("drop stale skill_usage_events constraint %s: %w", name, err)
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
		{
			"idx_sue_first_use_key_unique",
			"CREATE UNIQUE INDEX idx_sue_first_use_key_unique ON skill_usage_events(first_use_key)",
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
