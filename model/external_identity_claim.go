package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const ExternalIdentityProviderTelegram = AuthIdentityProviderTelegram

var ErrExternalIdentityAlreadyClaimed = errors.New("external identity is already claimed")

// ExternalIdentityClaim describes the legacy upstream identity table. It is a
// migration source only; AuthIdentity is the sole runtime ownership authority.
type ExternalIdentityClaim struct {
	Id                     int64      `json:"id" gorm:"primaryKey"`
	Provider               string     `json:"provider" gorm:"type:varchar(32);not null;uniqueIndex:idx_external_identity_subject,priority:1;uniqueIndex:idx_external_identity_user,priority:1"`
	Subject                string     `json:"subject" gorm:"type:varchar(128);not null;uniqueIndex:idx_external_identity_subject,priority:2"`
	UserId                 int        `json:"user_id" gorm:"not null;index;uniqueIndex:idx_external_identity_user,priority:2"`
	CreatedAt              time.Time  `json:"created_at"`
	AuthIdentityMigratedAt *time.Time `json:"-" gorm:"column:auth_identity_migrated_at"`
}

func (ExternalIdentityClaim) TableName() string {
	return "external_identity_claims"
}

// ClaimExternalIdentityWithTx preserves the upstream Telegram API while using
// AuthIdentity as the only runtime table.
func ClaimExternalIdentityWithTx(tx *gorm.DB, provider, subject string, userId int) error {
	err := CreateAuthIdentityWithTx(tx, userId, provider, subject)
	if isKnownAuthIdentityConflict(err) {
		return errors.Join(ErrExternalIdentityAlreadyClaimed, err)
	}
	return err
}

func ReleaseExternalIdentityWithTx(tx *gorm.DB, provider string, userId int) error {
	return DeleteAuthIdentityWithTx(tx, userId, provider)
}

func releaseAllExternalIdentitiesWithTx(tx *gorm.DB, userId int) error {
	if tx == nil || userId <= 0 {
		return errors.New("external identity release is invalid")
	}
	return tx.Where("user_id = ?", userId).Delete(&AuthIdentity{}).Error
}

// InitializeExternalIdentityClaims remains as a compatibility entry point for
// older startup code. It migrates all supported identity sources.
func InitializeExternalIdentityClaims() error {
	return InitializeAuthIdentities()
}
