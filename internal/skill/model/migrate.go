package skillmodel

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// MigrateSkills runs all DB migration steps for the skills table.
// Order is fixed: AutoMigrate → CHECK constraints → JSONB upgrade (PG only) → indexes → timestamp defaults.
func MigrateSkills(db *gorm.DB) error {
	// Runs before AutoMigrate so the creator columns land from the field definitions
	// even if AutoMigrate later trips on something else (Module3 P1).
	if err := migrateSkillsCreatorColumns(db); err != nil {
		return err
	}
	if err := db.AutoMigrate(&Skill{}); err != nil {
		return err
	}
	if err := migrateSkillsConstraints(db); err != nil {
		return err
	}
	warnStaleSkillsStatusCheckSQLite(db)
	if err := createSkillsJSONBColumns(db); err != nil {
		return err
	}
	if err := createSkillsIndexes(db); err != nil {
		return err
	}
	if err := migrateSkillsTimestampDefaults(db); err != nil {
		return err
	}
	return nil
}

// MigrateSkillVersions runs all DB migration steps for the skill_versions table.
// Order is fixed: AutoMigrate → CHECK constraints → JSONB upgrade (PG only) → indexes → timestamp defaults.
func MigrateSkillVersions(db *gorm.DB) error {
	if db.Dialector.Name() == "sqlite" {
		if err := createSkillVersionsSQLiteTable(db); err != nil {
			return err
		}
	} else if db.Dialector.Name() == "mysql" {
		if err := createSkillVersionsMySQLTable(db); err != nil {
			return err
		}
	} else {
		if err := migrateSkillVersionInstructionColumns(db); err != nil {
			return err
		}
		// Before AutoMigrate: a NOT NULL column that does not exist yet would
		// otherwise make AutoMigrate choke on the existing rows (DR-93 cf6676f5).
		if err := migrateSkillVersionCreatorColumns(db); err != nil {
			return err
		}
		if err := db.AutoMigrate(&SkillVersion{}); err != nil {
			return err
		}
	}
	if err := migrateSkillVersionsConstraints(db); err != nil {
		return err
	}
	if err := migrateSkillVersionInstructionColumns(db); err != nil {
		return err
	}
	if err := migrateSkillVersionCreatorColumns(db); err != nil {
		return err
	}
	if err := createSkillVersionsJSONBColumns(db); err != nil {
		return err
	}
	if err := migrateSkillVersionPackageColumns(db); err != nil {
		return err
	}
	if err := createSkillVersionsIndexes(db); err != nil {
		return err
	}
	if err := migrateSkillVersionsTimestampDefaults(db); err != nil {
		return err
	}
	return nil
}

// MigrateSkillAuditLog runs the audit-log migration used by Skill admin APIs.
func MigrateSkillAuditLog(db *gorm.DB) error {
	if err := db.AutoMigrate(&SkillAuditLog{}); err != nil {
		return err
	}
	if err := createSkillAuditLogJSONBColumns(db); err != nil {
		return err
	}
	if err := createSkillAuditLogIndexes(db); err != nil {
		return err
	}
	return nil
}

func createSkillVersionsSQLiteTable(db *gorm.DB) error {
	return db.Exec(`
		CREATE TABLE IF NOT EXISTS skill_versions (
			id char(36) NOT NULL PRIMARY KEY,
			skill_id char(36) NOT NULL,
			version_number integer NOT NULL,
			status varchar(32) NOT NULL DEFAULT 'draft',
			instruction_template text NOT NULL,
			instruction_template_sha256 char(64) NOT NULL,
			prompt_guard_template text,
			output_schema text,
			download_instructions text NOT NULL DEFAULT '',
			usage_instructions text NOT NULL DEFAULT '',
			prerequisites text NOT NULL DEFAULT '[]',
			quickstart text NOT NULL DEFAULT '[]',
			example_io text NOT NULL DEFAULT '[]',
			model_whitelist_snapshot text NOT NULL,
			required_plan_snapshot varchar(32) NOT NULL,
			monetization_snapshot text NOT NULL,
			max_input_tokens_snapshot integer,
			variables_schema text NOT NULL DEFAULT '[]',
			minhash_signature text,
			package_zip blob,
			package_sha256 char(64),
			package_built_at datetime,
			rollout_percentage integer NOT NULL DEFAULT 100,
			experiment_name varchar(128),
			created_by bigint NOT NULL,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			activated_at datetime,
			archived_at datetime,
			CONSTRAINT fk_skill_versions_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
			CONSTRAINT chk_skill_versions_status CHECK (status IN ('draft','active','inactive','archived')),
			CONSTRAINT chk_skill_versions_required_plan_snapshot CHECK (required_plan_snapshot IN ('free','pro','enterprise')),
			CONSTRAINT chk_skill_versions_max_input_tokens_snapshot CHECK (max_input_tokens_snapshot IS NULL OR max_input_tokens_snapshot > 0),
			CONSTRAINT chk_skill_versions_rollout_percentage CHECK (rollout_percentage BETWEEN 0 AND 100),
			CONSTRAINT uni_skill_versions_skill_version UNIQUE (skill_id, version_number)
		)
	`).Error
}

func createSkillVersionsMySQLTable(db *gorm.DB) error {
	return db.Exec(`
		CREATE TABLE IF NOT EXISTS skill_versions (
			id char(36) NOT NULL,
			skill_id char(36) NOT NULL,
			version_number bigint NOT NULL,
			status varchar(32) NOT NULL DEFAULT 'draft',
			instruction_template text NOT NULL,
			instruction_template_sha256 char(64) NOT NULL,
			prompt_guard_template text,
			output_schema text,
			download_instructions text NOT NULL,
			usage_instructions text NOT NULL,
			prerequisites text NOT NULL,
			quickstart text NOT NULL,
			example_io text NOT NULL,
			model_whitelist_snapshot text NOT NULL,
			required_plan_snapshot varchar(32) NOT NULL,
			monetization_snapshot text NOT NULL,
			max_input_tokens_snapshot bigint,
			variables_schema text NOT NULL,
			minhash_signature text,
			package_zip longblob,
			package_sha256 char(64),
			package_built_at datetime(3),
			rollout_percentage bigint NOT NULL DEFAULT 100,
			experiment_name varchar(128),
			created_by bigint NOT NULL,
			created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			activated_at datetime(3),
			archived_at datetime(3),
			active_skill_id char(36) GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN skill_id ELSE NULL END) STORED,
			PRIMARY KEY (id),
			KEY idx_skill_versions_skill_id (skill_id),
			CONSTRAINT fk_skill_versions_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON UPDATE RESTRICT ON DELETE RESTRICT
		)
	`).Error
}

func migrateSkillVersionPackageColumns(db *gorm.DB) error {
	cols := []string{"package_zip", "package_sha256", "package_built_at"}
	for _, col := range cols {
		if db.Migrator().HasColumn(&SkillVersion{}, col) {
			continue
		}
		if err := db.Migrator().AddColumn(&SkillVersion{}, col); err != nil {
			return fmt.Errorf("add skill_versions %s: %w", col, err)
		}
	}
	return nil
}

// migrateSkillVersionCreatorColumns adds the Module3 P1 prompt-template columns
// to an existing skill_versions table. Mirrors migrateSkillVersionInstructionColumns
// (DR-93): the two hand-written CREATE TABLEs cover fresh SQLite/MySQL installs,
// PostgreSQL falls through to AutoMigrate, and this covers upgrades on all three.
//
// variables_schema is NOT NULL, so ADD COLUMN must be followed by a backfill —
// an existing row would otherwise hold NULL and violate the struct's contract.
func migrateSkillVersionCreatorColumns(db *gorm.DB) error {
	if !db.Migrator().HasTable(&SkillVersion{}) {
		return nil
	}
	cols := []struct {
		name        string
		sqliteMySQL string
		postgres    string
	}{
		{"variables_schema", "text", "jsonb"},
		{"minhash_signature", "text", "text"},
	}
	for _, col := range cols {
		if db.Migrator().HasColumn(&SkillVersion{}, col.name) {
			continue
		}
		ddlType := col.sqliteMySQL
		if db.Dialector.Name() == "postgres" {
			ddlType = col.postgres
		}
		if err := db.Exec(fmt.Sprintf("ALTER TABLE skill_versions ADD COLUMN %s %s", col.name, ddlType)).Error; err != nil {
			return fmt.Errorf("add skill_versions %s: %w", col.name, err)
		}
	}
	// minhash_signature is deliberately not backfilled: NULL means "never fingerprinted".
	if err := db.Exec("UPDATE skill_versions SET variables_schema = '[]' WHERE variables_schema IS NULL").Error; err != nil {
		return fmt.Errorf("backfill skill_versions variables_schema: %w", err)
	}
	return nil
}

func migrateSkillVersionInstructionColumns(db *gorm.DB) error {
	if !db.Migrator().HasTable(&SkillVersion{}) {
		return nil
	}
	cols := []struct {
		name        string
		sqliteMySQL string
		postgres    string
	}{
		{"download_instructions", "text", "text"},
		{"usage_instructions", "text", "text"},
		{"prerequisites", "text", "jsonb"},
		{"quickstart", "text", "jsonb"},
		{"example_io", "text", "jsonb"},
	}
	for _, col := range cols {
		if db.Migrator().HasColumn(&SkillVersion{}, col.name) {
			continue
		}
		var sql string
		switch db.Dialector.Name() {
		case "postgres":
			sql = fmt.Sprintf("ALTER TABLE skill_versions ADD COLUMN %s %s", col.name, col.postgres)
		default:
			sql = fmt.Sprintf("ALTER TABLE skill_versions ADD COLUMN %s %s", col.name, col.sqliteMySQL)
		}
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("add skill_versions %s: %w", col.name, err)
		}
	}
	updates := map[string]string{
		"download_instructions": "''",
		"usage_instructions":    "''",
		"prerequisites":         "'[]'",
		"quickstart":            "'[]'",
		"example_io":            "'[]'",
	}
	for col, value := range updates {
		if err := db.Exec(fmt.Sprintf("UPDATE skill_versions SET %s = %s WHERE %s IS NULL", col, value, col)).Error; err != nil {
			return fmt.Errorf("backfill skill_versions %s: %w", col, err)
		}
	}
	return nil
}

// migrateSkillsCreatorColumns adds the Module3 P1 creator-workflow columns to an
// existing skills table. Uses Migrator().AddColumn rather than hand-written ALTER
// so the DDL is generated from the field definition — a hand-written type that
// drifts from the struct tag would make the next AutoMigrate decide the column
// needs altering, which is the table-rebuild path we must never enter on SQLite.
func migrateSkillsCreatorColumns(db *gorm.DB) error {
	if !db.Migrator().HasTable(&Skill{}) {
		return nil // fresh database: AutoMigrate creates the table with these columns
	}
	cols := []string{
		"source", "creator_id", "review_status", "review_actor_id",
		"reviewed_at", "review_note", "scan_report", "scanned_at",
	}
	for _, col := range cols {
		if db.Migrator().HasColumn(&Skill{}, col) {
			continue
		}
		if err := db.Migrator().AddColumn(&Skill{}, col); err != nil {
			return fmt.Errorf("add skills %s: %w", col, err)
		}
	}
	// Defensive: ADD COLUMN carries the NOT NULL DEFAULT, but an interrupted
	// migration could leave the column present and empty.
	if db.Migrator().HasColumn(&Skill{}, "source") {
		if err := db.Exec("UPDATE skills SET source = ? WHERE source IS NULL OR source = ''", SkillSourceOfficial).Error; err != nil {
			return fmt.Errorf("backfill skills source: %w", err)
		}
	}
	return nil
}

// refreshSkillsStatusConstraint drops chk_skills_status so the widened expression
// is rebuilt by the caller. Without this the change is a permanent silent no-op:
// the apply loop skips any constraint whose NAME already exists, and the name did
// not change when the creator statuses were added (Module3 P1).
//
// Dialect-explicit on purpose. PG and MySQL spell this differently, and going
// through Migrator().DropConstraint would route via GuessConstraintAndTable, which
// only recognises a name declared in a struct tag — a coupling the P1 columns
// deliberately avoid.
func refreshSkillsStatusConstraint(db *gorm.DB) error {
	const name = "chk_skills_status"
	if !db.Migrator().HasConstraint(&Skill{}, name) {
		return nil
	}
	switch db.Dialector.Name() {
	case "postgres":
		if err := db.Exec("ALTER TABLE skills DROP CONSTRAINT IF EXISTS " + name).Error; err != nil {
			return fmt.Errorf("drop stale skills constraint %s: %w", name, err)
		}
	case "mysql":
		if err := db.Exec("ALTER TABLE skills DROP CHECK " + name).Error; err != nil {
			return fmt.Errorf("drop stale skills constraint %s: %w", name, err)
		}
	}
	return nil
}

// warnStaleSkillsStatusCheckSQLite logs when a SQLite database predates the
// creator workflow. SQLite cannot ALTER a CHECK constraint, so such a database
// keeps the old four-value expression forever.
//
// Nothing writes the new statuses yet, so this is silent until a later phase
// tries — at which point the failure reads as a bug in that phase rather than as
// a stale local database. Log-only: never returns an error, never blocks boot.
func warnStaleSkillsStatusCheckSQLite(db *gorm.DB) {
	if db.Dialector.Name() != "sqlite" {
		return
	}
	var ddl string
	if err := db.Raw("SELECT sql FROM sqlite_master WHERE type='table' AND name='skills'").Scan(&ddl).Error; err != nil {
		return
	}
	if ddl == "" || !strings.Contains(ddl, "chk_skills_status") {
		return
	}
	if strings.Contains(ddl, "'submitted'") {
		return
	}
	common.SysError("skills.status CHECK on this SQLite database predates the creator " +
		"workflow and will reject 'submitted'/'sandbox'/'pending_launch'. SQLite cannot " +
		"ALTER a CHECK constraint. Delete the dev database (default ./one-api.db, or " +
		"$SQLITE_PATH) and restart to recreate it. PostgreSQL/MySQL are migrated " +
		"automatically. See docs/tasks/skill-creator-data-model-prd.md D2.")
}

// migrateSkillsConstraints adds the 9 hand-written CHECK constraints to PG and MySQL >= 8.0.16.
// MySQL < 8.0.16: no-op — named CHECK constraints are parsed but silently ignored by the engine,
// and the ALTER TABLE ADD CONSTRAINT syntax may not be supported reliably; app-layer
// enums.Valid() + range checks are the constraint gate for those versions.
// SQLite: no-op (CHECK constraints are written at CREATE TABLE time via struct check: tags).
func migrateSkillsConstraints(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		// proceed
	case "mysql":
		ok, err := isMySQLAtLeast8016DB(db)
		if err != nil {
			return fmt.Errorf("detect mysql version for CHECK constraints: %w", err)
		}
		if !ok {
			return nil // MySQL < 8.0.16: skip CHECK DDL entirely
		}
	default:
		return nil
	}

	constraints := []struct {
		name string
		expr string
	}{
		{"chk_skills_status", "status IN ('draft','submitted','sandbox','pending_launch','published','deprecated','archived')"},
		{"chk_skills_required_plan", "required_plan IN ('free','pro','enterprise')"},
		{"chk_skills_monetization_type", "monetization_type IN ('free','plan_included','token_markup','one_time','plus_exclusive')"},
		{"chk_skills_kids_approval_status", "kids_approval_status IN ('not_required','pending','approved','emergency_approved','rejected','revoked')"},
		{"chk_skills_timeout_seconds", "timeout_seconds BETWEEN 1 AND 120"},
		{"chk_skills_free_quota", "free_quota_per_month IS NULL OR free_quota_per_month >= 0"},
		{"chk_skills_max_input_tokens", "max_input_tokens IS NULL OR max_input_tokens > 0"},
		{"chk_skills_featured_rank", "featured_rank IS NULL OR featured_rank >= 0"},
		{"chk_skills_kids_exclusive_requires_safe", "is_kids_exclusive = false OR is_kids_safe = true"},
		// Module3 P1. These three exist ONLY here, never as struct tags: a new
		// constraint name on an already-existing table makes gorm call
		// CreateConstraint, and the glebarez/sqlite migrator then rebuilds a table
		// whose DDL contains IN(...) and fails with "invalid DDL, unbalanced
		// brackets" — every existing SQLite install would fail to boot. The cost is
		// that they do not exist on SQLite at all; enums.Valid() and the
		// SkillSource* constants are the gate there. See the PRD's M1.
		{"chk_skills_source", "source IN ('official','creator')"},
		{"chk_skills_review_status", "review_status IS NULL OR review_status IN ('open','assigned','escalated','resolved','reopened')"},
		{"chk_skills_creator_has_creator_id", "source <> 'creator' OR creator_id IS NOT NULL"},
	}

	if err := refreshSkillsStatusConstraint(db); err != nil {
		return err
	}

	for _, c := range constraints {
		if c.name == "chk_skills_monetization_type" && db.Migrator().HasConstraint(&Skill{}, c.name) {
			if err := db.Migrator().DropConstraint(&Skill{}, c.name); err != nil {
				return fmt.Errorf("drop constraint %s: %w", c.name, err)
			}
		}
		if db.Migrator().HasConstraint(&Skill{}, c.name) {
			continue
		}
		sql := fmt.Sprintf("ALTER TABLE skills ADD CONSTRAINT %s CHECK (%s)", c.name, c.expr)
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("add constraint %s: %w", c.name, err)
		}
	}
	return nil
}

// isPGColumnJSONB reports whether a column in the given table is already of type jsonb.
func isPGColumnJSONB(db *gorm.DB, table, col string) (bool, error) {
	var dataType string
	err := db.Raw(
		`SELECT data_type FROM information_schema.columns
		 WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
		table, col,
	).Scan(&dataType).Error
	if err != nil {
		return false, err
	}
	return dataType == "jsonb", nil
}

// createSkillsJSONBColumns upgrades the JSON-like TEXT columns to jsonb on PostgreSQL.
// No-op on MySQL and SQLite (those keep TEXT with app-layer [] guarantee).
func createSkillsJSONBColumns(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	// col → PG default after the jsonb upgrade; empty string = nullable, no default
	// (same shape as createSkillVersionsJSONBColumns).
	colDefaults := []struct {
		col        string
		defaultVal string
	}{
		{"tags", "'[]'::jsonb"},
		{"input_hints", "'[]'::jsonb"},
		{"example_inputs", "'[]'::jsonb"},
		{"example_outputs", "'[]'::jsonb"},
		{"model_whitelist", "'[]'::jsonb"},
		// Module3 P1. Nullable and object-shaped: NULL = never scanned, which is
		// correct for every official skill. Must NOT get an array default.
		{"scan_report", ""},
	}
	for _, cd := range colDefaults {
		if !db.Migrator().HasColumn(&Skill{}, cd.col) {
			continue
		}
		already, err := isPGColumnJSONB(db, "skills", cd.col)
		if err != nil {
			return fmt.Errorf("check jsonb column %s: %w", cd.col, err)
		}
		if already {
			continue
		}
		steps := []string{
			fmt.Sprintf("ALTER TABLE skills ALTER COLUMN %s DROP DEFAULT", cd.col),
			fmt.Sprintf("ALTER TABLE skills ALTER COLUMN %s TYPE jsonb USING %s::jsonb", cd.col, cd.col),
		}
		if cd.defaultVal != "" {
			steps = append(steps, fmt.Sprintf("ALTER TABLE skills ALTER COLUMN %s SET DEFAULT %s", cd.col, cd.defaultVal))
		}
		for _, sql := range steps {
			if err := db.Exec(sql).Error; err != nil {
				return fmt.Errorf("jsonb upgrade %s: %w", cd.col, err)
			}
		}
	}
	return nil
}

func createSkillVersionsJSONBColumns(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	// col → PG default after jsonb upgrade; empty string = nullable, no default (PRD §4.2).
	colDefaults := []struct {
		col        string
		defaultVal string
	}{
		{"output_schema", ""}, // NULL = no output schema (PRD §4.2)
		{"prerequisites", "'[]'::jsonb"},
		{"quickstart", "'[]'::jsonb"},
		{"example_io", "'[]'::jsonb"},
		{"model_whitelist_snapshot", "'[]'::jsonb"},
		{"monetization_snapshot", "'{}'::jsonb"}, // object shape, not array
		{"variables_schema", "'[]'::jsonb"},      // Module3 P1: {{name}} definitions
	}
	for _, cd := range colDefaults {
		already, err := isPGColumnJSONB(db, "skill_versions", cd.col)
		if err != nil {
			return fmt.Errorf("check skill_versions jsonb column %s: %w", cd.col, err)
		}
		if already {
			continue
		}
		steps := []string{
			fmt.Sprintf("ALTER TABLE skill_versions ALTER COLUMN %s DROP DEFAULT", cd.col),
			fmt.Sprintf("ALTER TABLE skill_versions ALTER COLUMN %s TYPE jsonb USING %s::jsonb", cd.col, cd.col),
		}
		if cd.defaultVal != "" {
			steps = append(steps, fmt.Sprintf("ALTER TABLE skill_versions ALTER COLUMN %s SET DEFAULT %s", cd.col, cd.defaultVal))
		}
		for _, sql := range steps {
			if err := db.Exec(sql).Error; err != nil {
				return fmt.Errorf("skill_versions jsonb upgrade %s: %w", cd.col, err)
			}
		}
	}
	return nil
}

func createSkillAuditLogJSONBColumns(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	cols := []struct {
		col        string
		defaultVal string
	}{
		{"changed_fields", "'[]'::jsonb"},
		{"before_value", ""},
		{"after_value", ""},
	}
	for _, cd := range cols {
		already, err := isPGColumnJSONB(db, "skill_audit_log", cd.col)
		if err != nil {
			return fmt.Errorf("check skill_audit_log jsonb column %s: %w", cd.col, err)
		}
		if already {
			continue
		}
		steps := []string{
			fmt.Sprintf("ALTER TABLE skill_audit_log ALTER COLUMN %s DROP DEFAULT", cd.col),
			fmt.Sprintf("ALTER TABLE skill_audit_log ALTER COLUMN %s TYPE jsonb USING %s::jsonb", cd.col, cd.col),
		}
		if cd.defaultVal != "" {
			steps = append(steps, fmt.Sprintf("ALTER TABLE skill_audit_log ALTER COLUMN %s SET DEFAULT %s", cd.col, cd.defaultVal))
		}
		for _, sql := range steps {
			if err := db.Exec(sql).Error; err != nil {
				return fmt.Errorf("skill_audit_log jsonb upgrade %s: %w", cd.col, err)
			}
		}
	}
	return nil
}

// isMySQLVersionAtLeast8016 parses a raw VERSION() string and returns true if >= 8.0.16.
// Handles suffixes like "8.0.46-log".
func isMySQLVersionAtLeast8016(ver string) (bool, error) {
	// Strip non-semver suffix (e.g. "8.0.46-log" → "8.0.46")
	clean := strings.FieldsFunc(ver, func(r rune) bool {
		return r != '.' && (r < '0' || r > '9')
	})
	if len(clean) == 0 {
		return false, fmt.Errorf("could not parse MySQL version: %q", ver)
	}
	parts := strings.SplitN(clean[0], ".", 3)
	var major, minor, patch int
	fmt.Sscanf(parts[0], "%d", &major)
	if len(parts) > 1 {
		fmt.Sscanf(parts[1], "%d", &minor)
	}
	if len(parts) > 2 {
		fmt.Sscanf(parts[2], "%d", &patch)
	}
	if major != 8 {
		return major > 8, nil
	}
	if minor != 0 {
		return minor > 0, nil
	}
	return patch >= 16, nil
}

// isMySQLAtLeast8016DB queries the connected MySQL instance and returns true if version >= 8.0.16.
func isMySQLAtLeast8016DB(db *gorm.DB) (bool, error) {
	var ver string
	if err := db.Raw("SELECT VERSION()").Scan(&ver).Error; err != nil {
		return false, err
	}
	return isMySQLVersionAtLeast8016(ver)
}

// migrateSkillsTimestampDefaults sets DB-level DEFAULT values for created_at and updated_at.
// GORM v1.25.2 quotes `default:CURRENT_TIMESTAMP` as a string literal for MySQL DATETIME,
// causing Error 1067; so we omit the GORM tag and apply the default via raw DDL here.
// PG: SET DEFAULT CURRENT_TIMESTAMP (idempotent).
// MySQL: MODIFY COLUMN with DEFAULT CURRENT_TIMESTAMP(3) and ON UPDATE for updated_at.
// SQLite: no-op (GORM autoCreateTime/autoUpdateTime is sufficient; ALTER COLUMN unsupported).
func migrateSkillsTimestampDefaults(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		for _, stmt := range []string{
			"ALTER TABLE skills ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP",
			"ALTER TABLE skills ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP",
		} {
			if err := db.Exec(stmt).Error; err != nil {
				return fmt.Errorf("set pg timestamp default: %w", err)
			}
		}
	case "mysql":
		// Each column is checked and repaired independently so that a partial failure
		// (e.g. created_at succeeded but updated_at failed on a previous run) can be
		// resumed on the next startup without silently leaving updated_at un-defaulted.
		// updated_at additionally checks EXTRA for ON UPDATE so that the auto-update
		// semantics are restored even when the DEFAULT is still present.
		cols := []struct {
			name          string
			ddl           string
			checkOnUpdate bool
		}{
			{
				"created_at",
				"ALTER TABLE skills MODIFY COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
				false,
			},
			{
				"updated_at",
				"ALTER TABLE skills MODIFY COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)",
				true,
			},
		}
		for _, c := range cols {
			var colDefault *string
			if err := db.Raw(
				`SELECT column_default FROM information_schema.columns
				 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = ?`,
				c.name,
			).Scan(&colDefault).Error; err != nil {
				return fmt.Errorf("check mysql timestamp default %s: %w", c.name, err)
			}
			needsDDL := colDefault == nil
			if !needsDDL && c.checkOnUpdate {
				var extra string
				if err := db.Raw(
					`SELECT EXTRA FROM information_schema.columns
					 WHERE table_schema = DATABASE() AND table_name = 'skills' AND column_name = ?`,
					c.name,
				).Scan(&extra).Error; err != nil {
					return fmt.Errorf("check mysql on update extra %s: %w", c.name, err)
				}
				if !strings.Contains(strings.ToLower(extra), "on update") {
					needsDDL = true
				}
			}
			if !needsDDL {
				continue
			}
			if err := db.Exec(c.ddl).Error; err != nil {
				return fmt.Errorf("set mysql timestamp default %s: %w", c.name, err)
			}
		}
	}
	return nil
}

func migrateSkillVersionsTimestampDefaults(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		if err := db.Exec(
			"ALTER TABLE skill_versions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP",
		).Error; err != nil {
			return fmt.Errorf("set pg skill_versions created_at default: %w", err)
		}
	case "mysql":
		var colDefault *string
		if err := db.Raw(
			`SELECT column_default FROM information_schema.columns
			 WHERE table_schema = DATABASE() AND table_name = 'skill_versions' AND column_name = 'created_at'`,
		).Scan(&colDefault).Error; err != nil {
			return fmt.Errorf("check mysql skill_versions created_at default: %w", err)
		}
		if colDefault == nil {
			if err := db.Exec(
				"ALTER TABLE skill_versions MODIFY COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
			).Error; err != nil {
				return fmt.Errorf("set mysql skill_versions created_at default: %w", err)
			}
		}
	}
	return nil
}

func migrateSkillVersionsConstraints(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		// proceed
	case "mysql":
		ok, err := isMySQLAtLeast8016DB(db)
		if err != nil {
			return fmt.Errorf("detect mysql version for skill_versions CHECK constraints: %w", err)
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
		{"chk_skill_versions_status", "status IN ('draft','active','inactive','archived')"},
		{"chk_skill_versions_required_plan_snapshot", "required_plan_snapshot IN ('free','pro','enterprise')"},
		{"chk_skill_versions_max_input_tokens_snapshot", "max_input_tokens_snapshot IS NULL OR max_input_tokens_snapshot > 0"},
		{"chk_skill_versions_rollout_percentage", "rollout_percentage BETWEEN 0 AND 100"},
	}

	for _, c := range constraints {
		if db.Migrator().HasConstraint(&SkillVersion{}, c.name) {
			continue
		}
		sql := fmt.Sprintf("ALTER TABLE skill_versions ADD CONSTRAINT %s CHECK (%s)", c.name, c.expr)
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("add skill_versions constraint %s: %w", c.name, err)
		}
	}
	return nil
}

// createSkillsIndexes creates the 5 indexes for the skills table.
// idx_skills_public_search (GIN tsvector) is PG-only; idx_skills_featured uses dialect-specific DDL.
func createSkillsIndexes(db *gorm.DB) error {
	dialect := db.Dialector.Name()

	var featuredDDL string
	switch dialect {
	case "postgres":
		featuredDDL = "CREATE INDEX idx_skills_featured ON skills(featured_flag, featured_rank) WHERE featured_flag = true"
	case "mysql":
		featuredDDL = "CREATE INDEX idx_skills_featured ON skills(featured_flag, featured_rank)"
	default: // sqlite
		featuredDDL = "CREATE INDEX idx_skills_featured ON skills(featured_flag, featured_rank) WHERE featured_flag = 1"
	}

	indexes := []struct {
		name   string
		ddl    string
		pgOnly bool
	}{
		{
			name:   "idx_skills_status_category",
			ddl:    "CREATE INDEX idx_skills_status_category ON skills(status, category)",
			pgOnly: false,
		},
		{
			name:   "idx_skills_featured",
			ddl:    featuredDDL,
			pgOnly: false,
		},
		{
			name:   "idx_skills_kids_status",
			ddl:    "CREATE INDEX idx_skills_kids_status ON skills(is_kids_safe, is_kids_exclusive, status)",
			pgOnly: false,
		},
		{
			name:   "idx_skills_required_plan",
			ddl:    "CREATE INDEX idx_skills_required_plan ON skills(required_plan, status)",
			pgOnly: false,
		},
		// Module3 P1 access paths: the creator's "my skills" list, the marketplace
		// source filter, and the admin review queue.
		{
			name:   "idx_skills_creator",
			ddl:    "CREATE INDEX idx_skills_creator ON skills(creator_id, status)",
			pgOnly: false,
		},
		{
			name:   "idx_skills_source_status",
			ddl:    "CREATE INDEX idx_skills_source_status ON skills(source, status)",
			pgOnly: false,
		},
		{
			name:   "idx_skills_review_status",
			ddl:    "CREATE INDEX idx_skills_review_status ON skills(review_status, status)",
			pgOnly: false,
		},
		{
			name: "idx_skills_public_search",
			ddl: `CREATE INDEX idx_skills_public_search ON skills
				USING GIN (
					to_tsvector('simple',
						coalesce(name, '') || ' ' ||
						coalesce(short_description, '') || ' ' ||
						coalesce(description, '')
					)
				)`,
			pgOnly: true,
		},
	}

	for _, idx := range indexes {
		if idx.pgOnly && dialect != "postgres" {
			continue
		}
		if db.Migrator().HasIndex(&Skill{}, idx.name) {
			continue
		}
		if err := db.Exec(idx.ddl).Error; err != nil {
			return fmt.Errorf("create index %s: %w", idx.name, err)
		}
	}
	return nil
}

func createSkillVersionsIndexes(db *gorm.DB) error {
	dialect := db.Dialector.Name()

	indexes := []struct {
		name string
		ddl  string
	}{
		{
			name: "idx_skill_versions_skill_version",
			ddl:  "CREATE UNIQUE INDEX idx_skill_versions_skill_version ON skill_versions(skill_id, version_number)",
		},
		{
			name: "idx_skill_versions_status",
			ddl:  "CREATE INDEX idx_skill_versions_status ON skill_versions(status)",
		},
	}

	for _, idx := range indexes {
		if db.Migrator().HasIndex(&SkillVersion{}, idx.name) {
			continue
		}
		if err := db.Exec(idx.ddl).Error; err != nil {
			return fmt.Errorf("create skill_versions index %s: %w", idx.name, err)
		}
	}

	switch dialect {
	case "postgres":
		if !db.Migrator().HasIndex(&SkillVersion{}, "idx_skill_versions_one_active") {
			if err := db.Exec(
				"CREATE UNIQUE INDEX idx_skill_versions_one_active ON skill_versions(skill_id) WHERE status = 'active'",
			).Error; err != nil {
				return fmt.Errorf("create skill_versions one-active index: %w", err)
			}
		}
	case "sqlite":
		if !db.Migrator().HasIndex(&SkillVersion{}, "idx_skill_versions_one_active") {
			if err := db.Exec(
				"CREATE UNIQUE INDEX idx_skill_versions_one_active ON skill_versions(skill_id) WHERE status = 'active'",
			).Error; err != nil {
				return fmt.Errorf("create sqlite skill_versions one-active index: %w", err)
			}
		}
	case "mysql":
		if !db.Migrator().HasColumn(&SkillVersion{}, "active_skill_id") {
			if err := db.Exec(
				"ALTER TABLE skill_versions ADD COLUMN active_skill_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN skill_id ELSE NULL END) STORED",
			).Error; err != nil {
				return fmt.Errorf("add mysql skill_versions active_skill_id generated column: %w", err)
			}
		}
		if !db.Migrator().HasIndex(&SkillVersion{}, "idx_skill_versions_one_active") {
			if err := db.Exec(
				"CREATE UNIQUE INDEX idx_skill_versions_one_active ON skill_versions(active_skill_id)",
			).Error; err != nil {
				return fmt.Errorf("create mysql skill_versions one-active index: %w", err)
			}
		}
	}

	return nil
}

func createSkillAuditLogIndexes(db *gorm.DB) error {
	indexes := []struct {
		name string
		ddl  string
	}{
		{
			name: "idx_skill_audit_log_skill_created",
			ddl:  "CREATE INDEX idx_skill_audit_log_skill_created ON skill_audit_log(skill_id, created_at)",
		},
		{
			name: "idx_skill_audit_log_action_created",
			ddl:  "CREATE INDEX idx_skill_audit_log_action_created ON skill_audit_log(action, created_at)",
		},
	}
	for _, idx := range indexes {
		if db.Migrator().HasIndex(&SkillAuditLog{}, idx.name) {
			continue
		}
		if err := db.Exec(idx.ddl).Error; err != nil {
			return fmt.Errorf("create skill_audit_log index %s: %w", idx.name, err)
		}
	}
	return nil
}
