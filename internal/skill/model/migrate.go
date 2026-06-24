package skillmodel

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// MigrateSkills runs all DB migration steps for the skills table.
// Order is fixed: AutoMigrate → CHECK constraints → JSONB upgrade (PG only) → indexes → timestamp defaults.
func MigrateSkills(db *gorm.DB) error {
	if err := db.AutoMigrate(&Skill{}); err != nil {
		return err
	}
	if err := migrateSkillsConstraints(db); err != nil {
		return err
	}
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
		if err := db.AutoMigrate(&SkillVersion{}); err != nil {
			return err
		}
	}
	if err := migrateSkillVersionsConstraints(db); err != nil {
		return err
	}
	if err := createSkillVersionsJSONBColumns(db); err != nil {
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
			model_whitelist_snapshot text NOT NULL,
			required_plan_snapshot varchar(32) NOT NULL,
			monetization_snapshot text NOT NULL,
			max_input_tokens_snapshot integer,
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
			model_whitelist_snapshot text NOT NULL,
			required_plan_snapshot varchar(32) NOT NULL,
			monetization_snapshot text NOT NULL,
			max_input_tokens_snapshot bigint,
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
		{"chk_skills_status", "status IN ('draft','published','deprecated','archived')"},
		{"chk_skills_required_plan", "required_plan IN ('free','pro','enterprise')"},
		{"chk_skills_monetization_type", "monetization_type IN ('free','plan_included','token_markup')"},
		{"chk_skills_kids_approval_status", "kids_approval_status IN ('not_required','pending','approved','emergency_approved','rejected','revoked')"},
		{"chk_skills_timeout_seconds", "timeout_seconds BETWEEN 1 AND 120"},
		{"chk_skills_free_quota", "free_quota_per_month IS NULL OR free_quota_per_month >= 0"},
		{"chk_skills_max_input_tokens", "max_input_tokens IS NULL OR max_input_tokens > 0"},
		{"chk_skills_featured_rank", "featured_rank IS NULL OR featured_rank >= 0"},
		{"chk_skills_kids_exclusive_requires_safe", "is_kids_exclusive = false OR is_kids_safe = true"},
	}

	for _, c := range constraints {
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

// createSkillsJSONBColumns upgrades the 5 JSON-like TEXT columns to jsonb on PostgreSQL.
// No-op on MySQL and SQLite (those keep TEXT with app-layer [] guarantee).
func createSkillsJSONBColumns(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	cols := []string{"tags", "input_hints", "example_inputs", "example_outputs", "model_whitelist"}
	for _, col := range cols {
		already, err := isPGColumnJSONB(db, "skills", col)
		if err != nil {
			return fmt.Errorf("check jsonb column %s: %w", col, err)
		}
		if already {
			continue
		}
		steps := []string{
			fmt.Sprintf("ALTER TABLE skills ALTER COLUMN %s DROP DEFAULT", col),
			fmt.Sprintf("ALTER TABLE skills ALTER COLUMN %s TYPE jsonb USING %s::jsonb", col, col),
			fmt.Sprintf("ALTER TABLE skills ALTER COLUMN %s SET DEFAULT '[]'::jsonb", col),
		}
		for _, sql := range steps {
			if err := db.Exec(sql).Error; err != nil {
				return fmt.Errorf("jsonb upgrade %s: %w", col, err)
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
		{"model_whitelist_snapshot", "'[]'::jsonb"},
		{"monetization_snapshot", "'{}'::jsonb"}, // object shape, not array
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
