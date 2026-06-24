package skillmodel

import (
	"time"

	"gorm.io/gorm"
)

// UserEnabledSkill tracks per-(user, tenant, skill) enablement state.
// Re-enable updates the same row via atomic UPSERT; do not read-then-insert.
//
// DR-55 contract: a row here is a download/enablement state record, NOT a
// standalone execution grant. It is a necessary-but-not-sufficient runtime
// eligibility input: Relay may read enabled/lifecycle state, but execution is
// authorized per call only after runner key + current subscription/entitlement
// + quota + Kids + lifecycle checks (use-time enforcement owned by
// DR-64/DR-68/M05). This table holds no execution grant / runner token /
// entitlement override / credential, by design.
//
// user_id and tenant_id store the platform's int64 user IDs, not UUIDs (D1).
// For V1, tenant_id == user_id (no separate tenant entity in the platform).
// skill_id is CHAR(36) matching skills.id (DR-40 D1: CHAR(36) all DBs).
//
// Timestamp tags intentionally omit default:CURRENT_TIMESTAMP — GORM v1.25.2
// quotes it as a string literal for MySQL DATETIME causing Error 1067 (DR-40 D8
// analog). DB-level defaults are applied post-AutoMigrate by migrateUESTimestampDefaults.
type UserEnabledSkill struct {
	UserID   int64  `gorm:"column:user_id;type:bigint;not null;primaryKey"`
	TenantID int64  `gorm:"column:tenant_id;type:bigint;not null;primaryKey"`
	SkillID  string `gorm:"column:skill_id;type:char(36);not null;primaryKey"`

	Enabled    bool       `gorm:"column:enabled;not null;default:true"`
	EnabledAt  time.Time  `gorm:"column:enabled_at;not null"`
	DisabledAt *time.Time `gorm:"column:disabled_at"`
	RemovedAt  *time.Time `gorm:"column:removed_at"`
	Source     string     `gorm:"column:source;type:varchar(64);not null;default:marketplace"`
	LastUsedAt *time.Time `gorm:"column:last_used_at"`

	CreatedAt time.Time `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null;autoUpdateTime"`
}

func (UserEnabledSkill) TableName() string { return "user_enabled_skills" }

// BeforeCreate guards against zero-time EnabledAt when db.Create is called directly
// (e.g., test fixtures, admin tools). EnableSkillForUser always sets EnabledAt
// explicitly; this hook is a safety net, not the primary write path.
func (u *UserEnabledSkill) BeforeCreate(tx *gorm.DB) error {
	if u.EnabledAt.IsZero() {
		u.EnabledAt = time.Now().UTC()
	}
	return nil
}

// EnableSkillForUser atomically upserts the enablement row for (userID, tenantID, skillID).
// On conflict: sets enabled=true, updates enabled_at to now, clears disabled_at
// and removed_at so a fresh download restores My Skills visibility.
// source is NOT overwritten on re-enable — only enabled/enabled_at/disabled_at/removed_at/updated_at change.
// The caller is responsible for validating Skill status and user entitlement.
func EnableSkillForUser(db *gorm.DB, userID, tenantID int64, skillID, source string) error {
	now := time.Now().UTC()
	if source == "" {
		source = "marketplace"
	}
	if db.Dialector.Name() == "mysql" {
		return db.Exec(`
			INSERT INTO user_enabled_skills
			  (user_id, tenant_id, skill_id, enabled, enabled_at, disabled_at, removed_at, source, created_at, updated_at)
			VALUES (?, ?, ?, 1, ?, NULL, NULL, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
			  enabled = 1, enabled_at = VALUES(enabled_at), disabled_at = NULL,
			  removed_at = NULL, updated_at = VALUES(updated_at)`,
			userID, tenantID, skillID, now, source, now, now,
		).Error
	}
	return db.Exec(`
		INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled, enabled_at, disabled_at, removed_at, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
		ON CONFLICT (user_id, tenant_id, skill_id) DO UPDATE SET
		  enabled = true, enabled_at = EXCLUDED.enabled_at,
		  disabled_at = NULL, removed_at = NULL, updated_at = EXCLUDED.updated_at`,
		userID, tenantID, skillID, true, now, source, now, now,
	).Error
}

// DisableSkillForUser sets enabled=false and records disabled_at for the given row.
// Strict idempotency: already-disabled rows (enabled=false, disabled_at IS NOT NULL)
// are not touched — disabled_at/enabled/updated_at remain unchanged.
// Half-bad state repair: rows with enabled=false but disabled_at IS NULL are fixed.
func DisableSkillForUser(db *gorm.DB, userID, tenantID int64, skillID string) error {
	now := time.Now().UTC()
	return db.Exec(`
		UPDATE user_enabled_skills
		SET enabled = ?, disabled_at = ?, updated_at = ?
		WHERE user_id = ? AND tenant_id = ? AND skill_id = ?
		  AND (enabled = ? OR disabled_at IS NULL)`,
		false, now, now,
		userID, tenantID, skillID,
		true,
	).Error
}

// RemoveSkillFromMySkills hides a downloaded Skill from the user's My Skills
// library without changing enabled. Existing downloaded packages therefore keep
// using the runtime authorization path, where enabled remains one input.
func RemoveSkillFromMySkills(db *gorm.DB, userID, tenantID int64, skillID string) error {
	now := time.Now().UTC()
	return db.Exec(`
		UPDATE user_enabled_skills
		SET removed_at = ?, updated_at = ?
		WHERE user_id = ? AND tenant_id = ? AND skill_id = ?
		  AND removed_at IS NULL`,
		now, now,
		userID, tenantID, skillID,
	).Error
}

// UpdateLastUsedAt records the time a skill was last executed (called by M05 Relay layer).
func UpdateLastUsedAt(db *gorm.DB, userID, tenantID int64, skillID string) error {
	now := time.Now().UTC()
	return db.Exec(`
		UPDATE user_enabled_skills
		SET last_used_at = ?, updated_at = ?
		WHERE user_id = ? AND tenant_id = ? AND skill_id = ?`,
		now, now,
		userID, tenantID, skillID,
	).Error
}
