package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	StudioServiceChargePending = "pending"
	StudioServiceChargeDone    = "done"
)

var (
	ErrStudioServiceChargeInsufficientWallet = errors.New("studio service fee wallet quota insufficient")
	ErrStudioServiceChargeInsufficientToken  = errors.New("studio service fee token quota insufficient")
	ErrStudioServiceChargeConflict           = errors.New("studio service fee idempotency conflict")
	ErrStudioServiceChargePending            = errors.New("studio service fee charge is pending manual review")
)

type StudioServiceCharge struct {
	Id         int     `json:"id" gorm:"primaryKey"`
	UserId     int     `json:"user_id" gorm:"not null;uniqueIndex:idx_studio_service_user_job"`
	JobId      string  `json:"job_id" gorm:"type:varchar(64);not null;uniqueIndex:idx_studio_service_user_job"`
	TaskId     string  `json:"task_id" gorm:"type:varchar(128);not null"`
	Quota      int     `json:"quota" gorm:"not null"`
	ChargedPts float64 `json:"charged_pts" gorm:"not null"`
	Status     string  `json:"status" gorm:"type:varchar(16);not null;index"`
	CreatedAt  int64   `json:"created_at" gorm:"bigint;not null"`
	UpdatedAt  int64   `json:"updated_at" gorm:"bigint;not null"`
}

func ClaimStudioServiceCharge(userId int, jobId, taskId string, quota int) (*StudioServiceCharge, bool, error) {
	now := common.GetTimestamp()
	charge := &StudioServiceCharge{
		UserId:    userId,
		JobId:     jobId,
		TaskId:    taskId,
		Quota:     quota,
		Status:    StudioServiceChargePending,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := DB.Create(charge).Error; err == nil {
		return charge, true, nil
	} else {
		var existing StudioServiceCharge
		findErr := DB.Where("user_id = ? AND job_id = ?", userId, jobId).First(&existing).Error
		if findErr == nil {
			return &existing, false, nil
		}
		if !errors.Is(findErr, gorm.ErrRecordNotFound) {
			return nil, false, findErr
		}
		return nil, false, err
	}
}

func CompleteStudioServiceCharge(id int, chargedPts float64) error {
	result := DB.Model(&StudioServiceCharge{}).
		Where("id = ? AND status = ?", id, StudioServiceChargePending).
		Updates(map[string]interface{}{
			"charged_pts": chargedPts,
			"status":      StudioServiceChargeDone,
			"updated_at":  common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("studio service charge claim is no longer pending")
	}
	return nil
}

// ChargeStudioServiceFee atomically records and applies one idempotent Studio
// service charge. tokenId=0 is the managed-session path and charges only the
// user's wallet; API-key calls also update the token's quota counters.
func ChargeStudioServiceFee(userId, tokenId int, jobId, taskId string, quota int, chargedPts float64) (*StudioServiceCharge, bool, error) {
	if userId <= 0 || tokenId < 0 || jobId == "" || quota <= 0 {
		return nil, false, errors.New("invalid studio service charge parameters")
	}

	var charge StudioServiceCharge
	charged := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}

		var token *Token
		if tokenId > 0 {
			var row Token
			if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", tokenId, userId).First(&row).Error; err != nil {
				return err
			}
			token = &row
		}

		now := common.GetTimestamp()
		charge = StudioServiceCharge{
			UserId: userId, JobId: jobId, TaskId: taskId, Quota: quota,
			Status: StudioServiceChargePending, CreatedAt: now, UpdatedAt: now,
		}
		result := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "job_id"}},
			DoNothing: true,
		}).Create(&charge)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			if err := lockForUpdate(tx).Where("user_id = ? AND job_id = ?", userId, jobId).First(&charge).Error; err != nil {
				return err
			}
			if charge.TaskId != taskId || charge.Quota != quota {
				return ErrStudioServiceChargeConflict
			}
			if charge.Status != StudioServiceChargeDone {
				return ErrStudioServiceChargePending
			}
			return nil
		}

		if user.Quota < quota {
			return ErrStudioServiceChargeInsufficientWallet
		}
		if token != nil && !token.UnlimitedQuota && token.RemainQuota < quota {
			return ErrStudioServiceChargeInsufficientToken
		}
		userResult := tx.Model(&User{}).
			Where("id = ? AND quota >= ?", userId, quota).
			Update("quota", gorm.Expr("quota - ?", quota))
		if userResult.Error != nil {
			return userResult.Error
		}
		if userResult.RowsAffected != 1 {
			return ErrStudioServiceChargeInsufficientWallet
		}
		if token != nil {
			tokenResult := tx.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]interface{}{
				"remain_quota":  gorm.Expr("remain_quota - ?", quota),
				"used_quota":    gorm.Expr("used_quota + ?", quota),
				"accessed_time": now,
			})
			if tokenResult.Error != nil {
				return tokenResult.Error
			}
			if tokenResult.RowsAffected != 1 {
				return fmt.Errorf("studio service fee token %d disappeared during charge", token.Id)
			}
		}
		complete := tx.Model(&StudioServiceCharge{}).
			Where("id = ? AND status = ?", charge.Id, StudioServiceChargePending).
			Updates(map[string]interface{}{
				"charged_pts": chargedPts,
				"status":      StudioServiceChargeDone,
				"updated_at":  now,
			})
		if complete.Error != nil {
			return complete.Error
		}
		if complete.RowsAffected != 1 {
			return errors.New("studio service charge could not be completed")
		}
		charge.ChargedPts = chargedPts
		charge.Status = StudioServiceChargeDone
		charged = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	if charged {
		if err := RefreshImageAutoBillingQuotaCaches(userId, tokenId); err != nil {
			common.SysLog("failed to refresh Studio service fee quota caches: " + err.Error())
		}
	}
	return &charge, charged, nil
}
