package skillmodel

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillUsageEvent records a Tier-1 platform event in skill_usage_events (tasks/03 §4.4).
//
// user_id and tenant_id store platform int64 IDs, not UUIDs (D1 deviation matching UES).
// For V1: tenant_id == user_id (no separate tenant entity).
// event_id is CHAR(36) UUID generated at emit time.
// metadata stores SkillJSONB object; restricted keys (instruction_template, prompt, etc.)
// must never be written here — see spec rule in §4.4.
type SkillUsageEvent struct {
	EventID    string    `gorm:"column:event_id;type:char(36);primaryKey;not null"`
	EventType  string    `gorm:"column:event_type;type:varchar(64);not null"`
	OccurredAt time.Time `gorm:"column:occurred_at;not null"`

	UserID    *int64  `gorm:"column:user_id;type:bigint"`
	TenantID  *int64  `gorm:"column:tenant_id;type:bigint"`
	RequestID *string `gorm:"column:request_id;type:varchar(128)"`

	SkillID        *string `gorm:"column:skill_id;type:char(36)"`
	SkillVersionID *string `gorm:"column:skill_version_id;type:char(36)"`
	EntryPoint     string  `gorm:"column:entry_point;type:varchar(64);not null"`

	Plan                 *string `gorm:"column:plan;type:varchar(32)"`
	IsKidsSession        bool    `gorm:"column:is_kids_session;not null;default:false"`
	IsKidsSafeSkill      *bool   `gorm:"column:is_kids_safe_skill"`
	IsKidsExclusiveSkill *bool   `gorm:"column:is_kids_exclusive_skill"`

	Success *bool `gorm:"column:success"`

	Metadata SkillJSONB `gorm:"column:metadata;type:text;not null"`
}

func (SkillUsageEvent) TableName() string { return "skill_usage_events" }

// EmitSkillEnabled inserts a skill_enabled event (tasks/03 §4.4, §8.2).
// skillVersionID may be nil until DR-41 (skill_versions) is implemented.
// entryPoint must be a valid enums.EntryPoint string value.
// plan is the runner's resolved plan (free/pro/enterprise) — i.e. the downloading
// user's own plan, NOT the skill's required_plan (see download.go: groupToPlan(group)).
// On error the caller should log but must not block the user-facing response.
func EmitSkillEnabled(db *gorm.DB, userID int64, skillID string, skillVersionID *string, entryPoint, plan string) error {
	uid := userID
	successVal := true
	return db.Create(&SkillUsageEvent{
		EventID:        uuid.New().String(),
		EventType:      "skill_enabled",
		OccurredAt:     time.Now().UTC(),
		UserID:         &uid,
		TenantID:       &uid,
		SkillID:        &skillID,
		SkillVersionID: skillVersionID,
		EntryPoint:     entryPoint,
		Plan:           &plan,
		IsKidsSession:  false,
		Success:        &successVal,
		Metadata:       SkillJSONB(`{}`),
	}).Error
}
