package skillmodel

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillTelemetryQuarantine stores sanitized diagnostics for malformed local-runner
// telemetry that should not enter production analytics. It intentionally does not
// store the raw request body because rejected telemetry may contain sensitive user
// content even when the schema is invalid.
type SkillTelemetryQuarantine struct {
	ID        string     `gorm:"column:id;type:char(36);primaryKey;not null"`
	CreatedAt time.Time  `gorm:"column:created_at;not null;index:idx_stq_user_time,priority:2"`
	UserID    int64      `gorm:"column:user_id;type:bigint;not null;index:idx_stq_user_time,priority:1"`
	TokenID   *int       `gorm:"column:token_id;type:integer"`
	Reason    string     `gorm:"column:reason;type:varchar(128);not null;index"`
	Fields    SkillJSONB `gorm:"column:fields;type:text;not null"`
}

func (SkillTelemetryQuarantine) TableName() string { return "skill_telemetry_quarantines" }

func (q *SkillTelemetryQuarantine) BeforeCreate(tx *gorm.DB) error {
	if q.ID == "" {
		q.ID = uuid.New().String()
	}
	if q.CreatedAt.IsZero() {
		q.CreatedAt = time.Now().UTC()
	} else {
		q.CreatedAt = q.CreatedAt.UTC()
	}
	normalizeSkillJSONBObject(&q.Fields)
	return nil
}

func MigrateSkillTelemetryQuarantine(db *gorm.DB) error {
	if err := db.AutoMigrate(&SkillTelemetryQuarantine{}); err != nil {
		return err
	}
	if !db.Migrator().HasIndex(&SkillTelemetryQuarantine{}, "idx_stq_user_time") {
		if err := db.Exec("CREATE INDEX idx_stq_user_time ON skill_telemetry_quarantines(user_id, created_at)").Error; err != nil {
			return err
		}
	}
	return nil
}
