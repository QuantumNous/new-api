package skillmodel

import (
	"time"

	"gorm.io/gorm"
)

// UserSavedSkill tracks per-user saved/bookmarked Skills. It is independent of
// user_enabled_skills and is not an execution grant.
type UserSavedSkill struct {
	UserID   int64  `gorm:"column:user_id;type:bigint;not null;primaryKey;index:idx_uss_user_saved,priority:1"`
	TenantID int64  `gorm:"column:tenant_id;type:bigint;not null;primaryKey;index:idx_uss_user_saved,priority:2"`
	SkillID  string `gorm:"column:skill_id;type:char(36);not null;primaryKey;index:idx_uss_skill_saved,priority:1"`

	Saved     bool       `gorm:"column:saved;not null;default:true;index:idx_uss_skill_saved,priority:2;index:idx_uss_user_saved,priority:3"`
	SavedAt   time.Time  `gorm:"column:saved_at;not null;index:idx_uss_user_saved,priority:4"`
	UnsavedAt *time.Time `gorm:"column:unsaved_at"`
	Source    string     `gorm:"column:source;type:varchar(64);not null;default:marketplace"`

	CreatedAt time.Time `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null;autoUpdateTime"`
}

func (UserSavedSkill) TableName() string { return "user_saved_skills" }

func (u *UserSavedSkill) BeforeCreate(tx *gorm.DB) error {
	if u.SavedAt.IsZero() {
		u.SavedAt = time.Now().UTC()
	}
	if u.Source == "" {
		u.Source = "marketplace"
	}
	return nil
}

// SaveSkillForUser atomically upserts saved=true for (userID, tenantID, skillID).
func SaveSkillForUser(db *gorm.DB, userID, tenantID int64, skillID, source string) error {
	now := time.Now().UTC()
	if source == "" {
		source = "marketplace"
	}
	if db.Dialector.Name() == "mysql" {
		return db.Exec(`
			INSERT INTO user_saved_skills
			  (user_id, tenant_id, skill_id, saved, saved_at, unsaved_at, source, created_at, updated_at)
			VALUES (?, ?, ?, 1, ?, NULL, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
			  saved = 1, saved_at = VALUES(saved_at), unsaved_at = NULL,
			  updated_at = VALUES(updated_at)`,
			userID, tenantID, skillID, now, source, now, now,
		).Error
	}
	return db.Exec(`
		INSERT INTO user_saved_skills
		  (user_id, tenant_id, skill_id, saved, saved_at, unsaved_at, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
		ON CONFLICT (user_id, tenant_id, skill_id) DO UPDATE SET
		  saved = true, saved_at = EXCLUDED.saved_at,
		  unsaved_at = NULL, updated_at = EXCLUDED.updated_at`,
		userID, tenantID, skillID, true, now, source, now, now,
	).Error
}

// UnsaveSkillForUser sets saved=false. Already-unsaved rows are left unchanged.
func UnsaveSkillForUser(db *gorm.DB, userID, tenantID int64, skillID string) error {
	now := time.Now().UTC()
	return db.Exec(`
		UPDATE user_saved_skills
		SET saved = ?, unsaved_at = ?, updated_at = ?
		WHERE user_id = ? AND tenant_id = ? AND skill_id = ?
		  AND (saved = ? OR unsaved_at IS NULL)`,
		false, now, now,
		userID, tenantID, skillID,
		true,
	).Error
}
