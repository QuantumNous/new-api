package skillmodel

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SkillCall is one metered execution of a skill — the billing ledger the creator
// marketplace settles from (Module3 P1, docs/tasks/skill-creator-data-model-prd.md).
//
// Deliberately NOT skill_usage_events. That table is analytics: losing a row costs
// a point on a chart. This one answers "what do we owe this creator this month"
// and has to survive an audit, so it carries a de-duplication key and is written
// on the billing path rather than the telemetry path.
//
// Amounts are quota units, not cents. The PRD's original draft used *_cents, but
// the commission is credited to users.quota (an int of quota units), so storing
// cents would force a lossy conversion at the exact moment money changes hands.
// Matches Log.Quota and SkillPurchaseOrder.QuotaCharged.
//
// No foreign keys, for the same reason skill_usage_events has none: an
// append-only ledger must outlive a hard delete of the skill it refers to.
type SkillCall struct {
	ID string `gorm:"column:id;type:char(36);primaryKey;not null"`

	SkillID        string  `gorm:"column:skill_id;type:char(36);not null;index:idx_skill_calls_skill_time,priority:1"`
	SkillVersionID *string `gorm:"column:skill_version_id;type:char(36)"`
	VersionNumber  int     `gorm:"column:version_number;not null;default:0"`

	UserID    int64 `gorm:"column:user_id;type:bigint;not null;index:idx_skill_calls_user_time,priority:1"`
	TenantID  int64 `gorm:"column:tenant_id;type:bigint;not null"`
	CreatorID int64 `gorm:"column:creator_id;type:bigint;not null;index:idx_skill_calls_creator_time,priority:1"`

	// LogID points at the platform logs row this call was billed under. No FK:
	// logs is upstream-owned and gets pruned on its own schedule.
	LogID *int64 `gorm:"column:log_id;type:bigint"`

	// RequestID is the double-billing guard. Nullable rather than empty-string
	// defaulted so that multiple rows without one can coexist under the unique
	// index on every engine.
	RequestID *string `gorm:"column:request_id;type:varchar(64);uniqueIndex:idx_skill_calls_request_id"`

	// BaseQuota is the upstream model cost; MarkupQuota is what the creator's
	// markup added on top. CommissionQuota + PlatformQuota split MarkupQuota
	// according to the creator share, so the invariant is
	// MarkupQuota == CommissionQuota + PlatformQuota.
	BaseQuota       int `gorm:"column:base_quota;type:integer;not null;default:0"`
	MarkupQuota     int `gorm:"column:markup_quota;type:integer;not null;default:0"`
	CommissionQuota int `gorm:"column:commission_quota;type:integer;not null;default:0"`
	PlatformQuota   int `gorm:"column:platform_quota;type:integer;not null;default:0"`

	// MarkupBps is the rate this row was settled at, in basis points, recorded
	// rather than looked up: the creator may change their markup later and past
	// settlements must not move.
	MarkupBps int `gorm:"column:markup_bps;type:integer;not null;default:0;check:chk_skill_calls_markup_bps,markup_bps BETWEEN 0 AND 10000"`

	CalledAt time.Time `gorm:"column:called_at;not null;index:idx_skill_calls_skill_time,priority:2;index:idx_skill_calls_user_time,priority:2;index:idx_skill_calls_creator_time,priority:2"`

	CreatedAt time.Time `gorm:"column:created_at;not null;autoCreateTime"`
}

func (SkillCall) TableName() string { return "skill_calls" }

func (c *SkillCall) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	if c.CalledAt.IsZero() {
		c.CalledAt = time.Now().UTC()
	}
	return nil
}

// MigrateSkillCalls creates the per-call billing ledger.
//
// Plain AutoMigrate is enough: the table exists nowhere yet, so CreateTable emits
// the index and check: tags inline on all three dialects. The struct-tag CHECK is
// safe here precisely because there is no pre-existing table for the sqlite
// migrator to try to rebuild — see the PRD's M1 for why the skills columns cannot
// do the same.
func MigrateSkillCalls(db *gorm.DB) error {
	if err := db.AutoMigrate(&SkillCall{}); err != nil {
		return fmt.Errorf("AutoMigrate skill_calls: %w", err)
	}
	return nil
}
