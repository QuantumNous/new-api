package skillmodel

import (
	"fmt"

	"gorm.io/gorm"
)

// MigrateSkillVersions runs all DB migration steps for the skill_versions table
// (DR-47, spec §4.2). Order: AutoMigrate → CHECK constraints → indexes.
//
// Unlike skills, skill_versions JSON columns stay TEXT on all DBs (no PG jsonb
// upgrade) — they are never queried by JSON content. Timestamps rely on GORM's
// autoCreateTime; no raw-DDL DEFAULT step is needed because no struct tag uses
// default:CURRENT_TIMESTAMP (avoids the MySQL Error 1067 footgun, DR-40 D8).
func MigrateSkillVersions(db *gorm.DB) error {
	if err := db.AutoMigrate(&SkillVersion{}); err != nil {
		return fmt.Errorf("AutoMigrate SkillVersion: %w", err)
	}
	if err := migrateSkillVersionsConstraints(db); err != nil {
		return err
	}
	if err := createSkillVersionsIndexes(db); err != nil {
		return err
	}
	return nil
}

// migrateSkillVersionsConstraints adds the hand-written CHECK constraints on PG
// and MySQL >= 8.0.16. SQLite bakes them in at CREATE TABLE via struct check tags;
// MySQL < 8.0.16 relies on app-layer enums.Valid() + range checks.
func migrateSkillVersionsConstraints(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		// proceed
	case "mysql":
		ok, err := isMySQLAtLeast8016DB(db)
		if err != nil {
			return fmt.Errorf("detect mysql version for CHECK constraints: %w", err)
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
		{"chk_skill_versions_rollout", "rollout_percentage BETWEEN 0 AND 100"},
		{"chk_skill_versions_max_input_tokens", "max_input_tokens_snapshot IS NULL OR max_input_tokens_snapshot > 0"},
	}
	for _, c := range constraints {
		if db.Migrator().HasConstraint(&SkillVersion{}, c.name) {
			continue
		}
		sql := fmt.Sprintf("ALTER TABLE skill_versions ADD CONSTRAINT %s CHECK (%s)", c.name, c.expr)
		if err := db.Exec(sql).Error; err != nil {
			return fmt.Errorf("add constraint %s: %w", c.name, err)
		}
	}
	return nil
}

// createSkillVersionsIndexes creates the skill_status lookup index and the
// one-active enforcement index. The unique (skill_id, version_number) index is
// created by AutoMigrate from the struct uniqueIndex tag.
//
// idx_skill_versions_one_active enforces "at most one active version per skill"
// (spec §4.2). PG and SQLite support a partial UNIQUE index (WHERE status='active');
// MySQL does not support filtered indexes, so it gets a plain non-unique index and
// the single-active invariant is enforced at the application layer (publish/activate).
func createSkillVersionsIndexes(db *gorm.DB) error {
	dialect := db.Dialector.Name()

	var oneActiveDDL string
	switch dialect {
	case "postgres", "sqlite":
		oneActiveDDL = "CREATE UNIQUE INDEX idx_skill_versions_one_active ON skill_versions(skill_id) WHERE status = 'active'"
	default: // mysql: no partial index support
		oneActiveDDL = "CREATE INDEX idx_skill_versions_one_active ON skill_versions(skill_id, status)"
	}

	indexes := []struct {
		name string
		ddl  string
	}{
		{
			"idx_skill_versions_skill_status",
			"CREATE INDEX idx_skill_versions_skill_status ON skill_versions(skill_id, status)",
		},
		{
			"idx_skill_versions_one_active",
			oneActiveDDL,
		},
	}
	for _, idx := range indexes {
		if db.Migrator().HasIndex(&SkillVersion{}, idx.name) {
			continue
		}
		if err := db.Exec(idx.ddl).Error; err != nil {
			return fmt.Errorf("create index %s: %w", idx.name, err)
		}
	}
	return nil
}
