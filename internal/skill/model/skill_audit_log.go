package skillmodel

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillAuditLog stores security-sensitive Skill admin actions.
//
// ActorID follows this fork's Skill actor-ID deviation: platform users.Id
// BIGINT, not UUID. Audit values must never include prompt text.
type SkillAuditLog struct {
	ID             string      `gorm:"column:id;type:char(36);primaryKey;not null"`
	SkillID        *string     `gorm:"column:skill_id;type:char(36);index"`
	SkillVersionID *string     `gorm:"column:skill_version_id;type:char(36);index"`
	ActorID        int64       `gorm:"column:actor_id;type:bigint;not null"`
	ActorRole      string      `gorm:"column:actor_role;type:varchar(64);not null"`
	Action         string      `gorm:"column:action;type:varchar(96);not null;index"`
	ActionReason   *string     `gorm:"column:action_reason;type:text"`
	ChangedFields  SkillJSONB  `gorm:"column:changed_fields;type:text;not null"`
	BeforeValue    *SkillJSONB `gorm:"column:before_value;type:text"`
	AfterValue     *SkillJSONB `gorm:"column:after_value;type:text"`
	RequestID      *string     `gorm:"column:request_id;type:varchar(128)"`
	IPAddress      *string     `gorm:"column:ip_address;type:varchar(128)"`
	UserAgent      *string     `gorm:"column:user_agent;type:text"`
	CreatedAt      time.Time   `gorm:"column:created_at;not null;autoCreateTime"`
}

func (SkillAuditLog) TableName() string { return "skill_audit_log" }

func (a *SkillAuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	normalizeSkillJSONB(&a.ChangedFields)
	return nil
}
