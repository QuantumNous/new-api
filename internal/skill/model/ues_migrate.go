package skillmodel

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// MigrateUserEnabledSkills creates and configures the user_enabled_skills table.
//
// SQLite path (migrateUESSQLite):
//
//	CREATE TABLE IF NOT EXISTS with inline FK → createUESIndexes.
//	SQLite cannot ALTER TABLE ADD FK; FK must be in the initial CREATE TABLE.
//
// PG/MySQL path (4 steps, order fixed):
//
//  1. AutoMigrate — creates table + composite PK
//  2. createUESIndexes — explicit indexes before FK (avoids MySQL implicit index)
//  3. migrateUESForeignKey — ALTER TABLE ADD CONSTRAINT fk_ues_skill_id
//  4. migrateUESTimestampDefaults — DB-level DEFAULT on enabled_at/created_at/updated_at
func MigrateUserEnabledSkills(db *gorm.DB) error {
	if db.Dialector.Name() == "sqlite" {
		return migrateUESSQLite(db)
	}
	if err := db.AutoMigrate(&UserEnabledSkill{}); err != nil {
		return fmt.Errorf("AutoMigrate UserEnabledSkill: %w", err)
	}
	if err := createUESIndexes(db); err != nil {
		return err
	}
	if err := migrateUESForeignKey(db); err != nil {
		return err
	}
	if err := migrateUESTimestampDefaults(db); err != nil {
		return err
	}
	return nil
}

// migrateUESSQLite creates user_enabled_skills on SQLite with FK declared inline.
// SQLite cannot ALTER TABLE ADD FOREIGN KEY; FK must appear in the initial CREATE TABLE.
// Idempotent via CREATE TABLE IF NOT EXISTS.
// FK enforcement requires the DSN pragma ?_pragma=foreign_keys(1) on every connection.
func migrateUESSQLite(db *gorm.DB) error {
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS "user_enabled_skills" (
			"user_id"      INTEGER  NOT NULL,
			"tenant_id"    INTEGER  NOT NULL,
			"skill_id"     TEXT(36) NOT NULL,
			"enabled"      NUMERIC  NOT NULL DEFAULT 1,
			"enabled_at"   DATETIME NOT NULL,
			"disabled_at"  DATETIME NULL,
			"removed_at"   DATETIME NULL,
			"source"       TEXT     NOT NULL DEFAULT 'marketplace',
			"last_used_at" DATETIME NULL,
			"created_at"   DATETIME NOT NULL,
			"updated_at"   DATETIME NOT NULL,
			PRIMARY KEY ("user_id", "tenant_id", "skill_id"),
			FOREIGN KEY ("skill_id") REFERENCES "skills"("id")
		)`).Error; err != nil {
		return fmt.Errorf("create user_enabled_skills (SQLite): %w", err)
	}
	if !db.Migrator().HasColumn(&UserEnabledSkill{}, "removed_at") {
		if err := db.Migrator().AddColumn(&UserEnabledSkill{}, "RemovedAt"); err != nil {
			return fmt.Errorf("add removed_at to user_enabled_skills (SQLite): %w", err)
		}
	}
	return createUESIndexes(db)
}

// migrateUESForeignKey adds the FK constraint on PG and MySQL.
// Must be called AFTER createUESIndexes so MySQL InnoDB finds the explicit skill_id
// index and does not create a redundant implicit index.
// Not called for SQLite (FK is declared in the initial CREATE TABLE by migrateUESSQLite).
func migrateUESForeignKey(db *gorm.DB) error {
	if !db.Migrator().HasConstraint(&UserEnabledSkill{}, "fk_ues_skill_id") {
		if err := db.Exec(
			"ALTER TABLE user_enabled_skills ADD CONSTRAINT fk_ues_skill_id FOREIGN KEY (skill_id) REFERENCES skills(id)",
		).Error; err != nil {
			return fmt.Errorf("add fk_ues_skill_id (%s): %w", db.Dialector.Name(), err)
		}
	}
	return nil
}

// createUESIndexes creates the two query indexes for user_enabled_skills.
// Uses HasIndex + Exec for cross-DB idempotency (MySQL 5.7 lacks CREATE INDEX IF NOT EXISTS).
func createUESIndexes(db *gorm.DB) error {
	indexes := []struct{ name, ddl string }{
		{
			"idx_user_enabled_by_user",
			"CREATE INDEX idx_user_enabled_by_user ON user_enabled_skills(user_id, tenant_id, enabled)",
		},
		{
			"idx_user_enabled_by_skill",
			"CREATE INDEX idx_user_enabled_by_skill ON user_enabled_skills(skill_id, enabled)",
		},
	}
	for _, idx := range indexes {
		if !db.Migrator().HasIndex(&UserEnabledSkill{}, idx.name) {
			if err := db.Exec(idx.ddl).Error; err != nil {
				return fmt.Errorf("create index %s: %w", idx.name, err)
			}
		}
	}
	return nil
}

// migrateUESTimestampDefaults sets DB-level DEFAULT values for enabled_at, created_at,
// and updated_at. GORM v1.25.2 quotes default:CURRENT_TIMESTAMP as a string literal for
// MySQL DATETIME causing Error 1067 (DR-40 D8 analog), so struct tags omit the default
// and this function applies it via raw DDL post-AutoMigrate.
//
// SQLite: no-op (approved deviation — ALTER COLUMN SET DEFAULT not supported).
// created_at/updated_at are guaranteed by GORM hooks; enabled_at by EnableSkillForUser
// and BeforeCreate.
func migrateUESTimestampDefaults(db *gorm.DB) error {
	switch db.Dialector.Name() {
	case "postgres":
		pgCols := []struct{ col, def string }{
			{"enabled_at", "CURRENT_TIMESTAMP"},
			{"created_at", "CURRENT_TIMESTAMP"},
			{"updated_at", "CURRENT_TIMESTAMP"},
		}
		for _, c := range pgCols {
			var colDefault *string
			if err := db.Raw(
				`SELECT column_default FROM information_schema.columns
				 WHERE table_schema = current_schema()
				 AND table_name = 'user_enabled_skills' AND column_name = ?`,
				c.col,
			).Scan(&colDefault).Error; err != nil {
				return fmt.Errorf("check PG timestamp default for %s: %w", c.col, err)
			}
			if colDefault == nil {
				if err := db.Exec(
					"ALTER TABLE user_enabled_skills ALTER COLUMN " + c.col + " SET DEFAULT " + c.def,
				).Error; err != nil {
					return fmt.Errorf("set PG default for %s: %w", c.col, err)
				}
			}
		}

	case "mysql":
		type mysqlCol struct {
			name          string
			ddl           string
			checkOnUpdate bool
		}
		cols := []mysqlCol{
			{
				"enabled_at",
				"ALTER TABLE user_enabled_skills MODIFY COLUMN enabled_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
				false,
			},
			{
				"created_at",
				"ALTER TABLE user_enabled_skills MODIFY COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
				false,
			},
			{
				"updated_at",
				"ALTER TABLE user_enabled_skills MODIFY COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)",
				true,
			},
		}
		for _, c := range cols {
			var colDefault *string
			if err := db.Raw(
				`SELECT column_default FROM information_schema.columns
				 WHERE table_schema = DATABASE()
				 AND table_name = 'user_enabled_skills' AND column_name = ?`,
				c.name,
			).Scan(&colDefault).Error; err != nil {
				return fmt.Errorf("check MySQL timestamp default for %s: %w", c.name, err)
			}
			needsDDL := colDefault == nil
			if !needsDDL && c.checkOnUpdate {
				var extra string
				if err := db.Raw(
					`SELECT EXTRA FROM information_schema.columns
					 WHERE table_schema = DATABASE()
					 AND table_name = 'user_enabled_skills' AND column_name = ?`,
					c.name,
				).Scan(&extra).Error; err != nil {
					return fmt.Errorf("check MySQL on update extra for %s: %w", c.name, err)
				}
				if !strings.Contains(strings.ToLower(extra), "on update") {
					needsDDL = true
				}
			}
			if !needsDDL {
				continue
			}
			if err := db.Exec(c.ddl).Error; err != nil {
				return fmt.Errorf("set MySQL default for %s: %w", c.name, err)
			}
		}

	default:
		// SQLite: ALTER COLUMN SET DEFAULT not supported.
		// Approved deviation: created_at/updated_at guaranteed by GORM autoCreateTime/autoUpdateTime.
		// enabled_at: no DB default — BeforeCreate hook guards db.Create against zero-time;
		// raw SQL inserts must still provide enabled_at explicitly (non-zero).
		return nil
	}
	return nil
}
