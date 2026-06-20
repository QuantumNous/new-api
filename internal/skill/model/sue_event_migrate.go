package skillmodel

import (
	"fmt"

	"gorm.io/gorm"
)

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
			"request_id"              TEXT,
			"skill_id"                TEXT,
			"skill_version_id"        TEXT,
			"entry_point"             TEXT     NOT NULL,
			"plan"                    TEXT,
			"is_kids_session"         INTEGER  NOT NULL DEFAULT 0,
			"is_kids_safe_skill"      INTEGER,
			"is_kids_exclusive_skill" INTEGER,
			"success"                 INTEGER,
			"metadata"                TEXT     NOT NULL DEFAULT '{}',
			PRIMARY KEY ("event_id")
		)`).Error; err != nil {
		return fmt.Errorf("create skill_usage_events (SQLite): %w", err)
	}
	return createSUEIndexes(db)
}

// createSUEIndexes creates the three query indexes for skill_usage_events.
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
