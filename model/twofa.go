package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// TwoFA User 2FA Settings Form
type TwoFA struct {
	Id             int            `json:"id" gorm:"primaryKey"`
	UserId         int            `json:"user_id" gorm:"unique;not null;index"`
	Secret         string         `json:"-" gorm:"type:varchar(255);not null"` // TOTP key, not returned to frontend
	IsEnabled      bool           `json:"is_enabled"`
	FailedAttempts int            `json:"failed_attempts" gorm:"default:0"`
	LockedUntil    *time.Time     `json:"locked_until,omitempty"`
	LastUsedAt     *time.Time     `json:"last_used_at,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

// TwoFABackupCode backup code usage record table
type TwoFABackupCode struct {
	Id        int            `json:"id" gorm:"primaryKey"`
	UserId    int            `json:"user_id" gorm:"not null;index"`
	CodeHash  string         `json:"-" gorm:"type:varchar(255);not null"` // Backup code hash
	IsUsed    bool           `json:"is_used"`
	UsedAt    *time.Time     `json:"used_at,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// GetTwoFAByUserId Gets 2FA settings based on user ID
func GetTwoFAByUserId(userId int) (*TwoFA, error) {
	if userId == 0 {
		return nil, errors.New("user ID is empty")
	}

	var twoFA TwoFA
	err := DB.Where("user_id = ?", userId).First(&twoFA).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Return nil to indicate that 2FA is not set up
		}
		return nil, err
	}

	return &twoFA, nil
}

// IsTwoFAEnabled checks if the user has 2FA enabled
func IsTwoFAEnabled(userId int) (bool, error) {
	twoFA, err := GetTwoFAByUserId(userId)
	if err != nil {
		return false, err
	}
	return twoFA != nil && twoFA.IsEnabled, nil
}

func (t *TwoFA) updateUsageState() error {
	if t.Id == 0 {
		return errors.New("2FA record ID is empty")
	}
	return DB.Model(&TwoFA{}).Where("id = ?", t.Id).Updates(map[string]any{
		"failed_attempts": t.FailedAttempts,
		"locked_until":    t.LockedUntil,
		"last_used_at":    t.LastUsedAt,
	}).Error
}

// ResetFailedAttempts resets the number of failed attempts
func (t *TwoFA) ResetFailedAttempts() error {
	t.FailedAttempts = 0
	t.LockedUntil = nil
	return t.updateUsageState()
}

// IncrementFailedAttempts increases the number of failed attempts
func (t *TwoFA) IncrementFailedAttempts() error {
	if t.Id == 0 {
		return errors.New("2FA record ID is empty")
	}

	const maxUpdateRetries = 5
	for range maxUpdateRetries {
		var current TwoFA
		if err := DB.Select("id", "failed_attempts", "locked_until").First(&current, t.Id).Error; err != nil {
			return err
		}

		now := time.Now()
		if current.LockedUntil != nil && now.Before(*current.LockedUntil) {
			t.FailedAttempts = current.FailedAttempts
			t.LockedUntil = current.LockedUntil
			return nil
		}

		nextFailedAttempts := current.FailedAttempts + 1
		nextLockedUntil := current.LockedUntil
		if current.LockedUntil != nil {
			// The previous lockout has expired, so this failure starts a new window.
			nextFailedAttempts = 1
			nextLockedUntil = nil
		}
		if nextFailedAttempts >= common.MaxFailAttempts {
			lockUntil := now.Add(time.Duration(common.LockoutDuration) * time.Second)
			nextLockedUntil = &lockUntil
		}

		result := DB.Model(&TwoFA{}).
			Where("id = ? AND failed_attempts = ? AND (locked_until IS NULL OR locked_until <= ?)", current.Id, current.FailedAttempts, now).
			Updates(map[string]any{
				"failed_attempts": nextFailedAttempts,
				"locked_until":    nextLockedUntil,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}

		t.FailedAttempts = nextFailedAttempts
		t.LockedUntil = nextLockedUntil
		return nil
	}

	return errors.New("conflicting updates to the 2FA failure count, please retry")
}

// IsLocked checks whether the account is locked
func (t *TwoFA) IsLocked() bool {
	if t.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*t.LockedUntil)
}

func replaceBackupCodesWithTx(tx *gorm.DB, userId int, codes []string) error {
	if err := tx.Where("user_id = ?", userId).Delete(&TwoFABackupCode{}).Error; err != nil {
		return err
	}
	for _, code := range codes {
		hashedCode, err := common.HashBackupCode(code)
		if err != nil {
			return err
		}
		if err := tx.Create(&TwoFABackupCode{UserId: userId, CodeHash: hashedCode, IsUsed: false}).Error; err != nil {
			return err
		}
	}
	return nil
}

// ReplaceBackupCodesWithAuthVersion atomically replaces the factor's recovery
// credentials and advances the user's authentication version.
func ReplaceBackupCodesWithAuthVersion(userId int, codes []string) error {
	return replaceBackupCodesWithAuthVersion(userId, codes, nil)
}

func ReplaceBackupCodesForSession(identity AuthSessionIdentity, codes []string) error {
	return replaceBackupCodesWithAuthVersion(identity.UserID, codes, &identity)
}

func replaceBackupCodesWithAuthVersion(userId int, codes []string, identity *AuthSessionIdentity) error {
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if identity != nil {
			if err := ValidateAuthSessionWithTx(tx, *identity); err != nil {
				return err
			}
		} else if err := lockForUpdate(tx).Select("id").First(&User{}, userId).Error; err != nil {
			return err
		}
		var enabled TwoFA
		if err := lockForUpdate(tx).Where("user_id = ? AND is_enabled = ?", userId, true).First(&enabled).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTwoFANotEnabled
			}
			return err
		}
		if _, err := IncrementUserAuthVersionWithTx(tx, userId); err != nil {
			return err
		}
		return replaceBackupCodesWithTx(tx, userId, codes)
	}); err != nil {
		return err
	}
	return PublishUserAuthCache(userId)
}

// ValidateBackupCode validates and uses the backup code
func ValidateBackupCode(userId int, code string) (bool, error) {
	if !common.ValidateBackupCode(code) {
		return false, errors.New("the verification code or backup code is incorrect")
	}

	normalizedCode := common.NormalizeBackupCode(code)

	// Find unused backup codes
	var backupCodes []TwoFABackupCode
	if err := DB.Where("user_id = ? AND is_used = false", userId).Find(&backupCodes).Error; err != nil {
		return false, err
	}

	// Verification backup code
	for _, bc := range backupCodes {
		if common.ValidatePasswordAndHash(normalizedCode, bc.CodeHash) {
			now := time.Now()
			result := DB.Model(&TwoFABackupCode{}).
				Where("id = ? AND is_used = ?", bc.Id, false).
				Updates(map[string]any{
					"is_used": true,
					"used_at": now,
				})
			if result.Error != nil {
				return false, result.Error
			}
			return result.RowsAffected == 1, nil
		}
	}

	return false, nil
}

// GetUnusedBackupCodeCount Gets the number of unused backup codes
func GetUnusedBackupCodeCount(userId int) (int, error) {
	var count int64
	err := DB.Model(&TwoFABackupCode{}).Where("user_id = ? AND is_used = false", userId).Count(&count).Error
	return int(count), err
}

// DisableTwoFAWithAuthVersion atomically removes the factor and invalidates
// every access token issued against the previous security configuration.
func DisableTwoFAWithAuthVersion(userId int) error {
	return disableTwoFAWithAuthVersion(userId, nil)
}

func DisableTwoFAForSession(identity AuthSessionIdentity) error {
	return disableTwoFAWithAuthVersion(identity.UserID, &identity)
}

func disableTwoFAWithAuthVersion(userId int, identity *AuthSessionIdentity) error {
	if err := DB.Transaction(func(tx *gorm.DB) error {
		if identity != nil {
			if err := ValidateAuthSessionWithTx(tx, *identity); err != nil {
				return err
			}
		} else if err := lockForUpdate(tx).Select("id").First(&User{}, userId).Error; err != nil {
			return err
		}
		var twoFA TwoFA
		if err := lockForUpdate(tx).Where("user_id = ? AND is_enabled = ?", userId, true).First(&twoFA).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTwoFANotEnabled
			}
			return err
		}
		if _, err := IncrementUserAuthVersionWithTx(tx, userId); err != nil {
			return err
		}
		if err := tx.Unscoped().Where("user_id = ?", userId).Delete(&TwoFABackupCode{}).Error; err != nil {
			return err
		}
		return tx.Unscoped().Delete(&twoFA).Error
	}); err != nil {
		return err
	}
	return PublishUserAuthCache(userId)
}

// ValidateTOTPAndUpdateUsage validates TOTP and updates usage records
func (t *TwoFA) ValidateTOTPAndUpdateUsage(code string) (bool, error) {
	// Check if it is locked
	if t.IsLocked() {
		return false, fmt.Errorf("the account is locked, retry after %v", t.LockedUntil.Format("2006-01-02 15:04:05"))
	}

	// Verify TOTP code
	if !common.ValidateTOTPCode(t.Secret, code) {
		// Increase the number of failures
		if err := t.IncrementFailedAttempts(); err != nil {
			return false, err
		}
		return false, nil
	}

	// Verification is successful, the number of failures is reset and the last usage time is updated.
	now := time.Now()
	t.FailedAttempts = 0
	t.LockedUntil = nil
	t.LastUsedAt = &now

	if err := t.updateUsageState(); err != nil {
		return false, err
	}

	return true, nil
}

// ValidateBackupCodeAndUpdateUsage validates backup codes and updates usage records
func (t *TwoFA) ValidateBackupCodeAndUpdateUsage(code string) (bool, error) {
	// Check if it is locked
	if t.IsLocked() {
		return false, fmt.Errorf("the account is locked, retry after %v", t.LockedUntil.Format("2006-01-02 15:04:05"))
	}

	// Verification backup code
	valid, err := ValidateBackupCode(t.UserId, code)
	if err != nil {
		return false, err
	}

	if !valid {
		// Increase the number of failures
		if err := t.IncrementFailedAttempts(); err != nil {
			return false, err
		}
		return false, nil
	}

	// Verification is successful, the number of failures is reset and the last usage time is updated.
	now := time.Now()
	t.FailedAttempts = 0
	t.LockedUntil = nil
	t.LastUsedAt = &now

	if err := t.updateUsageState(); err != nil {
		return false, err
	}

	return true, nil
}

// GetTwoFAStats Gets 2FA statistics (for administrator use)
func GetTwoFAStats() (map[string]any, error) {
	var totalUsers, enabledUsers int64

	// Total number of users
	if err := DB.Model(&User{}).Count(&totalUsers).Error; err != nil {
		return nil, err
	}

	// Number of users with 2FA enabled
	if err := DB.Model(&TwoFA{}).Where("is_enabled = true").Count(&enabledUsers).Error; err != nil {
		return nil, err
	}

	enabledRate := float64(0)
	if totalUsers > 0 {
		enabledRate = float64(enabledUsers) / float64(totalUsers) * 100
	}

	return map[string]any{
		"total_users":   totalUsers,
		"enabled_users": enabledUsers,
		"enabled_rate":  fmt.Sprintf("%.1f%%", enabledRate),
	}, nil
}
