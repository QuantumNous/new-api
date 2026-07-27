package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const migrateLegacyAffQuotaSQL = `
UPDATE users
SET quota = quota + aff_quota, aff_quota = 0
WHERE aff_quota > 0 AND deleted_at IS NULL`

const legacyAffQuotaMigrationBatchSize = 500

const (
	legacyInvitationValueMigrationBatchSize = 500

	legacyInvitationValueAffQuotaSourceType = "aff_quota"
	legacyInvitationValueRewardSourceType   = "invite_subscription_reward"

	legacyInvitationValueAffQuotaKeyPrefix = "migration:invite-discount-v1:aff-quota:"
	legacyInvitationValueRewardKeyPrefix   = "migration:invite-discount-v1:invite-subscription-reward:"
)

type legacyInvitationMigrationPricing struct {
	quotaPerUnit decimal.Decimal
	snapshot     float64
	ratio        string
}

type legacyInvitationMigrationSnapshot struct {
	SourceType      string  `json:"source_type"`
	SourceQuota     int     `json:"source_quota"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	QuotaToUSDRatio string  `json:"quota_to_usd_ratio"`
	USDMinor        int64   `json:"usd_minor"`
}

func MigrateLegacyAffQuotaToQuota() error {
	lastUserId := 0
	for {
		var users []User
		if err := DB.Model(&User{}).
			Select("id").
			Where("aff_quota > ? AND id > ?", 0, lastUserId).
			Order("id ASC").
			Limit(legacyAffQuotaMigrationBatchSize).
			Find(&users).Error; err != nil {
			return err
		}
		if len(users) == 0 {
			return nil
		}

		userIds := make([]int, 0, len(users))
		for _, user := range users {
			userIds = append(userIds, user.Id)
		}
		if err := migrateLegacyAffQuotaBatch(userIds); err != nil {
			return err
		}
		lastUserId = users[len(users)-1].Id
	}
}

func migrateLegacyAffQuotaBatch(userIds []int) error {
	if len(userIds) == 0 {
		return nil
	}
	if err := DB.Exec(migrateLegacyAffQuotaSQL+" AND id IN ?", userIds).Error; err != nil {
		return err
	}
	for _, userId := range userIds {
		if err := InvalidateUserCache(userId); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate user %d cache after legacy invite reward migration: %v", userId, err))
		}
	}
	return nil
}

func MigrateUserLegacyAffQuotaToQuota(userId int) error {
	if userId <= 0 {
		return errors.New("user id must be positive")
	}

	result := DB.Exec(migrateLegacyAffQuotaSQL+" AND id = ?", userId)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return nil
	}
	if err := InvalidateUserCache(userId); err != nil {
		common.SysLog(fmt.Sprintf("failed to invalidate user %d cache after legacy invite reward migration: %v", userId, err))
	}
	return nil
}

func MigrateLegacyInvitationValueToSubscriptionDiscount() error {
	pricing, err := newLegacyInvitationMigrationPricing(common.QuotaPerUnit)
	if err != nil {
		return err
	}
	lastUserId := 0
	for {
		var users []User
		if err := DB.Model(&User{}).
			Select("id").
			Where("aff_quota > ? AND id > ?", 0, lastUserId).
			Order("id ASC").
			Limit(legacyInvitationValueMigrationBatchSize).
			Find(&users).Error; err != nil {
			return err
		}
		if len(users) == 0 {
			break
		}
		for _, user := range users {
			if err := migrateUserLegacyAffQuotaToSubscriptionDiscount(user.Id, pricing); err != nil {
				return err
			}
		}
		lastUserId = users[len(users)-1].Id
	}

	lastRewardId := 0
	for {
		var rewards []InviteSubscriptionReward
		if err := DB.Model(&InviteSubscriptionReward{}).
			Select("id").
			Where("status = ? AND id > ?", InviteSubRewardStatusPending, lastRewardId).
			Order("id ASC").
			Limit(legacyInvitationValueMigrationBatchSize).
			Find(&rewards).Error; err != nil {
			return err
		}
		if len(rewards) == 0 {
			return nil
		}
		for _, reward := range rewards {
			if err := migrateInviteSubscriptionRewardToSubscriptionDiscount(reward.Id, pricing); err != nil {
				return err
			}
		}
		lastRewardId = rewards[len(rewards)-1].Id
	}
}

func MigrateUserLegacyInvitationValueToSubscriptionDiscount(userId int) error {
	if userId <= 0 {
		return errors.New("user id must be positive")
	}
	pricing, err := newLegacyInvitationMigrationPricing(common.QuotaPerUnit)
	if err != nil {
		return err
	}
	if err := migrateUserLegacyAffQuotaToSubscriptionDiscount(userId, pricing); err != nil {
		return err
	}

	lastRewardId := 0
	for {
		var rewards []InviteSubscriptionReward
		if err := DB.Model(&InviteSubscriptionReward{}).
			Select("id").
			Where("inviter_id = ? AND status = ? AND id > ?", userId, InviteSubRewardStatusPending, lastRewardId).
			Order("id ASC").
			Limit(legacyInvitationValueMigrationBatchSize).
			Find(&rewards).Error; err != nil {
			return err
		}
		if len(rewards) == 0 {
			return nil
		}
		for _, reward := range rewards {
			if err := migrateInviteSubscriptionRewardToSubscriptionDiscount(reward.Id, pricing); err != nil {
				return err
			}
		}
		lastRewardId = rewards[len(rewards)-1].Id
	}
}

func migrateUserLegacyAffQuotaToSubscriptionDiscount(userId int, pricing legacyInvitationMigrationPricing) error {
	if userId <= 0 {
		return errors.New("user id must be positive")
	}
	migrated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		user, err := lockLegacyInvitationMigrationUserTx(tx, userId)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if user.AffQuota <= 0 {
			return nil
		}
		usdMinor := legacyInvitationQuotaToUSDMinor(user.AffQuota, pricing)
		key := legacyInvitationValueAffQuotaKey(user.Id)
		exists, err := validateExistingLegacyInvitationMigrationEntryTx(tx, key, user.Id, user.AffQuota, legacyInvitationValueAffQuotaSourceType)
		if err != nil {
			return err
		}
		if !exists && usdMinor > 0 {
			snapshot, err := legacyInvitationValuePricingSnapshot(legacyInvitationValueAffQuotaSourceType, user.AffQuota, usdMinor, pricing)
			if err != nil {
				return err
			}
			changed, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
				UserID:          user.Id,
				USDMinor:        usdMinor,
				EntryType:       SubscriptionDiscountEntryTypeMigration,
				SourceType:      legacyInvitationValueAffQuotaSourceType,
				SourceKey:       key,
				IdempotencyKey:  key,
				PricingSnapshot: snapshot,
			})
			if err != nil {
				return err
			}
			if !changed {
				if _, err := validateExistingLegacyInvitationMigrationEntryTx(tx, key, user.Id, user.AffQuota, legacyInvitationValueAffQuotaSourceType); err != nil {
					return err
				}
			}
		}
		update := tx.Model(&User{}).Where("id = ? AND aff_quota = ?", user.Id, user.AffQuota).Update("aff_quota", 0)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return ErrSubscriptionDiscountInvalidAccountState
		}
		migrated = true
		return nil
	})
	if err != nil {
		return err
	}
	if migrated {
		if err := InvalidateUserCache(userId); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate user %d cache after invite value migration: %v", userId, err))
		}
	}
	return nil
}

func migrateInviteSubscriptionRewardToSubscriptionDiscount(rewardId int, pricing legacyInvitationMigrationPricing) error {
	if rewardId <= 0 {
		return errors.New("reward id must be positive")
	}
	var inviterId int
	migrated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		reward, err := lockLegacyInvitationMigrationRewardTx(tx, rewardId)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if reward.Status != InviteSubRewardStatusPending {
			return nil
		}
		inviterId = reward.InviterId
		if _, err := lockLegacyInvitationMigrationUserTx(tx, reward.InviterId); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if reward.RewardQuota < 0 {
			return ErrSubscriptionDiscountInvalidAmount
		}
		usdMinor := legacyInvitationQuotaToUSDMinor(reward.RewardQuota, pricing)
		key := legacyInvitationValueRewardKey(reward.Id)
		exists, err := validateExistingLegacyInvitationMigrationEntryTx(tx, key, reward.InviterId, reward.RewardQuota, legacyInvitationValueRewardSourceType)
		if err != nil {
			return err
		}
		if !exists && usdMinor > 0 {
			snapshot, err := legacyInvitationValuePricingSnapshot(legacyInvitationValueRewardSourceType, reward.RewardQuota, usdMinor, pricing)
			if err != nil {
				return err
			}
			changed, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
				UserID:          reward.InviterId,
				USDMinor:        usdMinor,
				EntryType:       SubscriptionDiscountEntryTypeMigration,
				SourceType:      legacyInvitationValueRewardSourceType,
				SourceKey:       key,
				IdempotencyKey:  key,
				PricingSnapshot: snapshot,
			})
			if err != nil {
				return err
			}
			if !changed {
				if _, err := validateExistingLegacyInvitationMigrationEntryTx(tx, key, reward.InviterId, reward.RewardQuota, legacyInvitationValueRewardSourceType); err != nil {
					return err
				}
			}
		}
		now := getDBTimestampTx(tx)
		update := tx.Model(&InviteSubscriptionReward{}).
			Where("id = ? AND status = ?", reward.Id, InviteSubRewardStatusPending).
			Updates(map[string]any{
				"status":     InviteSubRewardStatusGranted,
				"granted_at": now,
				"unlock_at":  0,
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return ErrSubscriptionDiscountInvalidAccountState
		}
		migrated = update.RowsAffected > 0
		return nil
	})
	if err != nil {
		return err
	}
	if migrated && inviterId > 0 {
		if err := InvalidateUserCache(inviterId); err != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate inviter %d cache after invite reward migration: %v", inviterId, err))
		}
	}
	return nil
}

func lockLegacyInvitationMigrationUserTx(tx *gorm.DB, userId int) (*User, error) {
	if common.UsingSQLite {
		if err := retrySQLiteBusy(func() error {
			return tx.Model(&User{}).Where("id = ?", userId).Update("id", gorm.Expr("id")).Error
		}); err != nil {
			return nil, err
		}
		var user User
		if err := tx.Select("id", "aff_quota").Where("id = ?", userId).First(&user).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}
	query := tx
	if common.UsingMySQL || common.UsingPostgreSQL {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var user User
	if err := query.Select("id", "aff_quota").Where("id = ?", userId).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func lockLegacyInvitationMigrationRewardTx(tx *gorm.DB, rewardId int) (*InviteSubscriptionReward, error) {
	if common.UsingSQLite {
		if err := retrySQLiteBusy(func() error {
			return tx.Model(&InviteSubscriptionReward{}).Where("id = ?", rewardId).Update("id", gorm.Expr("id")).Error
		}); err != nil {
			return nil, err
		}
		var reward InviteSubscriptionReward
		if err := tx.Select("id", "inviter_id", "reward_quota", "status").
			Where("id = ?", rewardId).First(&reward).Error; err != nil {
			return nil, err
		}
		return &reward, nil
	}
	query := tx
	if common.UsingMySQL || common.UsingPostgreSQL {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var reward InviteSubscriptionReward
	if err := query.Select("id", "inviter_id", "reward_quota", "status").
		Where("id = ?", rewardId).First(&reward).Error; err != nil {
		return nil, err
	}
	return &reward, nil
}

func newLegacyInvitationMigrationPricing(quotaPerUnit float64) (legacyInvitationMigrationPricing, error) {
	if math.IsNaN(quotaPerUnit) || math.IsInf(quotaPerUnit, 0) || quotaPerUnit <= 0 {
		return legacyInvitationMigrationPricing{}, ErrSubscriptionDiscountInvalidAmount
	}
	return legacyInvitationMigrationPricing{
		quotaPerUnit: decimal.NewFromFloat(quotaPerUnit),
		snapshot:     quotaPerUnit,
		ratio:        fmt.Sprintf("%g:1", quotaPerUnit),
	}, nil
}

func legacyInvitationQuotaToUSDMinor(quota int, pricing legacyInvitationMigrationPricing) int64 {
	minor := decimal.NewFromInt(int64(quota)).
		Div(pricing.quotaPerUnit).
		Mul(decimal.NewFromInt(100)).
		Round(0)
	return minor.IntPart()
}

func legacyInvitationValuePricingSnapshot(sourceType string, sourceQuota int, usdMinor int64, pricing legacyInvitationMigrationPricing) (string, error) {
	payload := legacyInvitationMigrationSnapshot{
		SourceType:      sourceType,
		SourceQuota:     sourceQuota,
		QuotaPerUnit:    pricing.snapshot,
		QuotaToUSDRatio: pricing.ratio,
		USDMinor:        usdMinor,
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func validateExistingLegacyInvitationMigrationEntryTx(tx *gorm.DB, idempotencyKey string, userId int, sourceQuota int, sourceType string) (bool, error) {
	var entry SubscriptionDiscountEntry
	if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return true, validateLegacyInvitationMigrationEntry(entry, idempotencyKey, userId, sourceQuota, sourceType)
}

func validateLegacyInvitationMigrationEntry(entry SubscriptionDiscountEntry, idempotencyKey string, userId int, sourceQuota int, sourceType string) error {
	if entry.UserID != userId ||
		entry.EntryType != SubscriptionDiscountEntryTypeMigration ||
		entry.SourceType != sourceType ||
		entry.SourceKey != idempotencyKey ||
		entry.IdempotencyKey != idempotencyKey {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	var snapshot legacyInvitationMigrationSnapshot
	if err := common.Unmarshal([]byte(entry.PricingSnapshot), &snapshot); err != nil {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	pricing, err := newLegacyInvitationMigrationPricing(snapshot.QuotaPerUnit)
	if err != nil {
		return err
	}
	if snapshot.SourceType != sourceType ||
		snapshot.SourceQuota != sourceQuota ||
		snapshot.QuotaToUSDRatio != pricing.ratio ||
		snapshot.USDMinor != entry.AvailableDeltaUSDMinor ||
		entry.ReservedDeltaUSDMinor != 0 ||
		legacyInvitationQuotaToUSDMinor(sourceQuota, pricing) != snapshot.USDMinor {
		return ErrSubscriptionDiscountInvalidAccountState
	}
	return nil
}

func legacyInvitationValueAffQuotaKey(userId int) string {
	return fmt.Sprintf("%s%d", legacyInvitationValueAffQuotaKeyPrefix, userId)
}

func legacyInvitationValueRewardKey(rewardId int) string {
	return fmt.Sprintf("%s%d", legacyInvitationValueRewardKeyPrefix, rewardId)
}
