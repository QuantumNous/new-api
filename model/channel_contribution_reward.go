package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ChannelContributionRewardEntryEarn     = "earn"
	ChannelContributionRewardEntryTransfer = "transfer"
)

var ErrChannelContributionRewardInsufficientBalance = errors.New("channel contribution reward balance is insufficient")

type ChannelContributionRewardAccount struct {
	UserId              int   `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	Balance             int64 `json:"balance" gorm:"type:bigint;not null"`
	LifetimeEarned      int64 `json:"lifetime_earned" gorm:"type:bigint;not null"`
	LifetimeTransferred int64 `json:"lifetime_transferred" gorm:"type:bigint;not null"`
	CreatedAt           int64 `json:"created_at" gorm:"type:bigint;not null"`
	UpdatedAt           int64 `json:"updated_at" gorm:"type:bigint;index;not null"`
}

type ChannelContributionRewardLedger struct {
	Id              int64  `json:"id" gorm:"primaryKey"`
	UserId          int    `json:"user_id" gorm:"index;not null"`
	ContributionId  int    `json:"contribution_id" gorm:"index;not null"`
	ChannelId       int    `json:"channel_id" gorm:"uniqueIndex:uk_contribution_reward_request,priority:1;index;not null"`
	RequestId       string `json:"request_id" gorm:"type:varchar(128);uniqueIndex:uk_contribution_reward_request,priority:2;not null"`
	EntryType       string `json:"entry_type" gorm:"type:varchar(32);not null"`
	Amount          int64  `json:"amount" gorm:"type:bigint;not null"`
	BalanceAfter    int64  `json:"balance_after" gorm:"type:bigint;not null"`
	SourceQuota     int    `json:"source_quota" gorm:"not null"`
	RewardBps       int    `json:"reward_bps" gorm:"not null"`
	QuotaSaturated  bool   `json:"quota_saturated" gorm:"not null"`
	QuotaSaturation string `json:"quota_saturation" gorm:"type:text;not null"`
	CreatedAt       int64  `json:"created_at" gorm:"type:bigint;index;not null"`
}

type ChannelContributionRewardTarget struct {
	ContributionId int
	UserId         int
}

func (account *ChannelContributionRewardAccount) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if account.CreatedAt == 0 {
		account.CreatedAt = now
	}
	if account.UpdatedAt == 0 {
		account.UpdatedAt = now
	}
	return nil
}

func GetActiveChannelContributionRewardTarget(channelId int) (*ChannelContributionRewardTarget, error) {
	if channelId <= 0 {
		return nil, nil
	}
	var contribution ChannelContribution
	err := DB.Select("id", "user_id").
		Where("channel_id = ? AND status = ?", channelId, ChannelContributionStatusApproved).
		First(&contribution).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ChannelContributionRewardTarget{
		ContributionId: contribution.Id,
		UserId:         contribution.UserId,
	}, nil
}

func GetChannelContributionRewardAccount(userId int) (*ChannelContributionRewardAccount, error) {
	var account ChannelContributionRewardAccount
	err := DB.Where("user_id = ?", userId).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &ChannelContributionRewardAccount{UserId: userId}, nil
	}
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func ListChannelContributionRewardLedger(userId int, offset int, limit int) ([]*ChannelContributionRewardLedger, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	var total int64
	query := DB.Model(&ChannelContributionRewardLedger{}).Where("user_id = ?", userId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var entries []*ChannelContributionRewardLedger
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&entries).Error; err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func ListChannelContributionRewardTransfers(userId int, offset int, limit int) ([]*ChannelContributionRewardLedger, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	var total int64
	query := DB.Model(&ChannelContributionRewardLedger{}).
		Where("user_id = ? AND entry_type = ?", userId, ChannelContributionRewardEntryTransfer)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var entries []*ChannelContributionRewardLedger
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&entries).Error; err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func CreditChannelContributionReward(
	userId int,
	contributionId int,
	channelId int,
	requestId string,
	sourceQuota int,
	rewardBps int,
	amount int,
	quotaClamp *common.QuotaClamp,
) (bool, error) {
	if userId <= 0 || contributionId <= 0 || channelId <= 0 || requestId == "" {
		return false, errors.New("invalid channel contribution reward identity")
	}
	if sourceQuota <= 0 || rewardBps <= 0 || amount <= 0 {
		return false, nil
	}

	quotaSaturation := ""
	if quotaClamp != nil {
		encoded, err := common.Marshal(quotaClamp.AuditMap())
		if err != nil {
			return false, fmt.Errorf("marshal channel contribution reward saturation: %w", err)
		}
		quotaSaturation = string(encoded)
	}

	credited := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		entry := ChannelContributionRewardLedger{
			UserId:          userId,
			ContributionId:  contributionId,
			ChannelId:       channelId,
			RequestId:       requestId,
			EntryType:       ChannelContributionRewardEntryEarn,
			Amount:          int64(amount),
			SourceQuota:     sourceQuota,
			RewardBps:       rewardBps,
			QuotaSaturated:  quotaClamp != nil,
			QuotaSaturation: quotaSaturation,
			CreatedAt:       now,
		}
		result := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "channel_id"}, {Name: "request_id"}},
			DoNothing: true,
		}).Create(&entry)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}

		account := ChannelContributionRewardAccount{UserId: userId}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&account).Error; err != nil {
			return err
		}
		if err := lockForUpdate(tx).Where("user_id = ?", userId).First(&account).Error; err != nil {
			return err
		}
		if account.Balance > math.MaxInt64-int64(amount) || account.LifetimeEarned > math.MaxInt64-int64(amount) {
			return errors.New("channel contribution reward balance overflow")
		}
		account.Balance += int64(amount)
		account.LifetimeEarned += int64(amount)
		account.UpdatedAt = now
		if err := tx.Model(&ChannelContributionRewardAccount{}).
			Where("user_id = ?", userId).
			Updates(map[string]any{
				"balance":         account.Balance,
				"lifetime_earned": account.LifetimeEarned,
				"updated_at":      now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&ChannelContributionRewardLedger{}).
			Where("id = ?", entry.Id).
			Update("balance_after", account.Balance).Error; err != nil {
			return err
		}
		credited = true
		return nil
	})
	return credited, err
}

func TransferChannelContributionReward(userId int, amount int) (*ChannelContributionRewardLedger, error) {
	if userId <= 0 || amount <= 0 {
		return nil, errors.New("transfer amount must be positive")
	}
	if amount > common.MaxQuota {
		return nil, fmt.Errorf("transfer amount exceeds quota limit: %d", amount)
	}

	var entry ChannelContributionRewardLedger
	err := DB.Transaction(func(tx *gorm.DB) error {
		var account ChannelContributionRewardAccount
		if err := lockForUpdate(tx).Where("user_id = ?", userId).First(&account).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrChannelContributionRewardInsufficientBalance
			}
			return err
		}
		if account.Balance < int64(amount) {
			return ErrChannelContributionRewardInsufficientBalance
		}
		var user User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		newQuota := int64(user.Quota) + int64(amount)
		if newQuota > int64(common.MaxQuota) {
			return errors.New("user quota would exceed the supported limit")
		}

		now := common.GetTimestamp()
		newBalance := account.Balance - int64(amount)
		if account.LifetimeTransferred > math.MaxInt64-int64(amount) {
			return errors.New("channel contribution transfer counter overflow")
		}
		result := tx.Model(&ChannelContributionRewardAccount{}).
			Where("user_id = ? AND balance >= ?", userId, amount).
			Updates(map[string]any{
				"balance":              newBalance,
				"lifetime_transferred": account.LifetimeTransferred + int64(amount),
				"updated_at":           now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrChannelContributionRewardInsufficientBalance
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", int(newQuota)).Error; err != nil {
			return err
		}
		transferId, err := common.GenerateRandomCharsKey(24)
		if err != nil {
			return err
		}
		entry = ChannelContributionRewardLedger{
			UserId:       userId,
			RequestId:    "transfer_" + transferId,
			EntryType:    ChannelContributionRewardEntryTransfer,
			Amount:       -int64(amount),
			BalanceAfter: newBalance,
			CreatedAt:    now,
		}
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if err := cacheIncrUserQuota(userId, int64(amount)); err != nil {
		common.SysError(fmt.Sprintf("failed to update user quota cache after contribution reward transfer: user_id=%d err=%v", userId, err))
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("渠道贡献奖励划转 %s", logger.LogQuota(amount)))
	return &entry, nil
}
