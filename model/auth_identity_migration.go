package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// InitializeAuthIdentities imports every legacy external-identity source into
// auth_identities. The legacy tables remain available for rollback and audit,
// but runtime reads and writes use AuthIdentity exclusively.
func InitializeAuthIdentities() error {
	if err := prepareLegacyAuthIdentitySources(); err != nil {
		return err
	}
	if err := migrateLegacyExternalIdentityClaims(); err != nil {
		return err
	}
	if err := migrateLegacyUserOAuthBindings(); err != nil {
		return err
	}
	return backfillBuiltInAuthIdentities()
}

func prepareLegacyAuthIdentitySources() error {
	for _, source := range []any{&ExternalIdentityClaim{}, &UserOAuthBinding{}} {
		if !DB.Migrator().HasTable(source) {
			continue
		}
		if DB.Migrator().HasColumn(source, "AuthIdentityMigratedAt") {
			continue
		}
		if err := DB.Migrator().AddColumn(source, "AuthIdentityMigratedAt"); err != nil {
			return fmt.Errorf("cannot prepare legacy auth identity source: %w", err)
		}
	}
	return nil
}

func migrateLegacyExternalIdentityClaims() error {
	if !DB.Migrator().HasTable(&ExternalIdentityClaim{}) {
		return nil
	}

	lastID := int64(0)
	batchNumber := 0
	for {
		claims := make([]ExternalIdentityClaim, 0, authIdentityBackfillBatchSize)
		if err := DB.Unscoped().
			Select("id", "provider", "subject", "user_id").
			Where("id > ? AND auth_identity_migrated_at IS NULL", lastID).
			Order("id ASC").
			Limit(authIdentityBackfillBatchSize).
			Find(&claims).Error; err != nil {
			return fmt.Errorf("cannot load legacy external identity batch after row %d: %w", lastID, err)
		}
		if len(claims) == 0 {
			return nil
		}

		batchNumber++
		batchFirstID := claims[0].Id
		batchLastID := claims[len(claims)-1].Id
		conflictCount := 0
		orphanCount := 0
		malformedCount := 0
		if err := DB.Transaction(func(tx *gorm.DB) error {
			migratedAt := time.Now().UTC()
			for _, claim := range claims {
				exists, err := authIdentityMigrationUserExists(tx, claim.UserId)
				if err != nil {
					return fmt.Errorf("cannot validate legacy external identity row %d in batch %d: %w", claim.Id, batchNumber, err)
				}
				switch {
				case !exists:
					orphanCount++
				case isMalformedLegacyAuthIdentityInput(claim.Provider, claim.Subject):
					// Keep the batch moving: dirty legacy rows must not abort startup.
					malformedCount++
				default:
					if err := CreateAuthIdentityWithTx(tx, claim.UserId, claim.Provider, claim.Subject); err != nil {
						if !isKnownAuthIdentityConflict(err) {
							return fmt.Errorf("cannot migrate legacy external identity row %d in batch %d: %w", claim.Id, batchNumber, err)
						}
						conflictCount++
					}
				}
				if err := tx.Model(&ExternalIdentityClaim{}).
					Where("id = ? AND auth_identity_migrated_at IS NULL", claim.Id).
					Update("auth_identity_migrated_at", migratedAt).Error; err != nil {
					return fmt.Errorf("cannot mark legacy external identity row %d migrated: %w", claim.Id, err)
				}
			}
			return nil
		}); err != nil {
			return err
		}

		logAuthIdentityMigrationBatch("external identity", batchNumber, batchFirstID, batchLastID, conflictCount, orphanCount, malformedCount)
		lastID = batchLastID
		if len(claims) < authIdentityBackfillBatchSize {
			return nil
		}
	}
}

func migrateLegacyUserOAuthBindings() error {
	if !DB.Migrator().HasTable(&UserOAuthBinding{}) {
		return nil
	}

	lastID := 0
	batchNumber := 0
	for {
		bindings := make([]UserOAuthBinding, 0, authIdentityBackfillBatchSize)
		if err := DB.Unscoped().
			Select("id", "user_id", "provider_id", "provider_user_id").
			Where("id > ? AND auth_identity_migrated_at IS NULL", lastID).
			Order("id ASC").
			Limit(authIdentityBackfillBatchSize).
			Find(&bindings).Error; err != nil {
			return fmt.Errorf("cannot load legacy custom OAuth binding batch after row %d: %w", lastID, err)
		}
		if len(bindings) == 0 {
			return nil
		}

		batchNumber++
		batchFirstID := bindings[0].Id
		batchLastID := bindings[len(bindings)-1].Id
		conflictCount := 0
		orphanCount := 0
		malformedCount := 0
		if err := DB.Transaction(func(tx *gorm.DB) error {
			migratedAt := time.Now().UTC()
			for _, binding := range bindings {
				exists, err := authIdentityMigrationUserExists(tx, binding.UserId)
				if err != nil {
					return fmt.Errorf("cannot validate legacy custom OAuth binding row %d in batch %d: %w", binding.Id, batchNumber, err)
				}
				providerKey, keyErr := AuthIdentityProviderKeyForCustomOAuth(binding.ProviderId)
				malformedBinding := keyErr != nil ||
					isMalformedLegacyAuthIdentityInput(providerKey, binding.ProviderUserId)
				switch {
				case !exists:
					orphanCount++
				case malformedBinding:
					// provider_id <= 0, empty provider_user_id, or other key/subject input errors.
					malformedCount++
				default:
					if err := CreateAuthIdentityWithTx(tx, binding.UserId, providerKey, binding.ProviderUserId); err != nil {
						if !isKnownAuthIdentityConflict(err) {
							return fmt.Errorf("cannot migrate legacy custom OAuth binding row %d in batch %d: %w", binding.Id, batchNumber, err)
						}
						conflictCount++
					}
				}
				if err := tx.Model(&UserOAuthBinding{}).
					Where("id = ? AND auth_identity_migrated_at IS NULL", binding.Id).
					Update("auth_identity_migrated_at", migratedAt).Error; err != nil {
					return fmt.Errorf("cannot mark legacy custom OAuth binding row %d migrated: %w", binding.Id, err)
				}
			}
			return nil
		}); err != nil {
			return err
		}

		logAuthIdentityMigrationBatch("custom OAuth binding", batchNumber, int64(batchFirstID), int64(batchLastID), conflictCount, orphanCount, malformedCount)
		lastID = batchLastID
		if len(bindings) < authIdentityBackfillBatchSize {
			return nil
		}
	}
}

func authIdentityMigrationUserExists(tx *gorm.DB, userId int) (bool, error) {
	if userId <= 0 {
		return false, nil
	}
	var count int64
	if err := tx.Unscoped().Model(&User{}).Where("id = ?", userId).Count(&count).Error; err != nil {
		return false, err
	}
	return count == 1, nil
}

// deleteLegacyAuthIdentitySourcesWithTx removes migration-only records when a
// user is permanently deleted. These tables never participate in runtime
// ownership decisions, but hard deletion must still erase their user data.
func deleteLegacyAuthIdentitySourcesWithTx(tx *gorm.DB, userId int) error {
	if tx == nil || userId <= 0 {
		return errors.New("database transaction and user ID are required")
	}
	for _, source := range []any{&ExternalIdentityClaim{}, &UserOAuthBinding{}} {
		if !tx.Migrator().HasTable(source) {
			continue
		}
		if err := tx.Unscoped().Where("user_id = ?", userId).Delete(source).Error; err != nil {
			return err
		}
	}
	return nil
}

func isKnownAuthIdentityConflict(err error) bool {
	return errors.Is(err, ErrAuthIdentityAlreadyBound) ||
		errors.Is(err, ErrAuthIdentityProviderAlreadyBound)
}

// isMalformedLegacyAuthIdentityInput mirrors the input checks of
// normalizeAuthIdentity so dirty legacy rows can be skipped without aborting
// startup migration. It intentionally does not log the subject value.
func isMalformedLegacyAuthIdentityInput(providerKey string, providerSubject string) bool {
	providerKey = strings.ToLower(strings.TrimSpace(providerKey))
	providerSubject = strings.TrimSpace(providerSubject)
	return providerKey == "" ||
		providerSubject == "" ||
		len(providerKey) > 64 ||
		len(providerSubject) > 256
}

func logAuthIdentityMigrationBatch(
	source string,
	batchNumber int,
	firstID, lastID int64,
	conflictCount, orphanCount, malformedCount int,
) {
	if conflictCount == 0 && orphanCount == 0 && malformedCount == 0 {
		return
	}
	common.SysLog(fmt.Sprintf(
		"auth identity migration source %s batch %d rows %d-%d skipped %d known conflicts, %d missing users, and %d malformed rows",
		source,
		batchNumber,
		firstID,
		lastID,
		conflictCount,
		orphanCount,
		malformedCount,
	))
}
