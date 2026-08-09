package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type ActivityClaim struct {
	ID          int    `json:"id" gorm:"primaryKey"`
	UserID      int    `json:"user_id" gorm:"uniqueIndex:idx_activity_claim_user_key"`
	ActivityKey string `json:"activity_key" gorm:"type:varchar(64);uniqueIndex:idx_activity_claim_user_key"`
	Reward      int    `json:"reward"`
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (ActivityClaim) TableName() string { return "activity_claims" }

func HasActivityClaim(userID int, activityKey string) (bool, error) {
	var count int64
	err := DB.Model(&ActivityClaim{}).
		Where("user_id = ? AND activity_key = ?", userID, activityKey).
		Count(&count).Error
	return count > 0, err
}

func ClaimActivityReward(userID int, activityKey string, reward int) error {
	if userID <= 0 || activityKey == "" || reward <= 0 {
		return errors.New("invalid activity reward claim")
	}
	claim := ActivityClaim{
		UserID:      userID,
		ActivityKey: activityKey,
		Reward:      reward,
		CreatedAt:   time.Now().Unix(),
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&ActivityClaim{}).
			Where("user_id = ? AND activity_key = ?", userID, activityKey).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("activity reward already claimed")
		}
		if err := tx.Create(&claim).Error; err != nil {
			return err
		}
		update := tx.Model(&User{}).Where("id = ?", userID).
			Update("quota", gorm.Expr("quota + ?", reward))
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		return err
	}
	if err := cacheIncrUserQuota(userID, int64(reward)); err != nil {
		common.SysError(fmt.Sprintf("failed to update user %d quota cache after activity claim: %v", userID, err))
	}
	return nil
}
