package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

// ErrRedeemFailed is returned when redemption fails due to database error
var ErrRedeemFailed = errors.New("redeem.failed")

type Redemption struct {
	Id                    int            `json:"id"`
	UserId                int            `json:"user_id"`
	Key                   string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status                int            `json:"status" gorm:"default:1"`
	Name                  string         `json:"name" gorm:"index"`
	Quota                 int            `json:"quota" gorm:"default:100"`
	SubscriptionPlanId    int            `json:"subscription_plan_id" gorm:"type:int;default:0;index"`
	SubscriptionPlanTitle string         `json:"subscription_plan_title" gorm:"type:varchar(128);default:''"`
	CreatedTime           int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime          int64          `json:"redeemed_time" gorm:"bigint"`
	Count                 int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId            int            `json:"used_user_id"`
	DeletedAt             gorm.DeletedAt `gorm:"index"`
	ExpiredTime           int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedeemSubscriptionResult struct {
	UserSubscriptionId    int    `json:"user_subscription_id"`
	SubscriptionPlanId    int    `json:"subscription_plan_id"`
	SubscriptionPlanTitle string `json:"subscription_plan_title"`
	StartTime             int64  `json:"start_time"`
	EndTime               int64  `json:"end_time"`
	AmountTotal           int64  `json:"amount_total"`
}

type RedeemResult struct {
	Quota        int                       `json:"quota"`
	Subscription *RedeemSubscriptionResult `json:"subscription,omitempty"`
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Build query based on keyword type
	query := tx.Model(&Redemption{})

	// Only try to convert to ID if the string represents a valid integer
	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(key string, userId int) (*RedeemResult, error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}
	result := &RedeemResult{}
	var upgradeGroup string

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		if redemption.Quota > 0 {
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			result.Quota = redemption.Quota
		}
		if redemption.SubscriptionPlanId > 0 {
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.SubscriptionPlanId)
			if err != nil {
				return err
			}
			userSubscription, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				return err
			}
			planTitle := strings.TrimSpace(redemption.SubscriptionPlanTitle)
			if planTitle == "" {
				planTitle = plan.Title
			}
			result.Subscription = &RedeemSubscriptionResult{
				UserSubscriptionId:    userSubscription.Id,
				SubscriptionPlanId:    plan.Id,
				SubscriptionPlanTitle: planTitle,
				StartTime:             userSubscription.StartTime,
				EndTime:               userSubscription.EndTime,
				AmountTotal:           userSubscription.AmountTotal,
			}
			upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		}
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if upgradeGroup != "" {
		_ = UpdateUserGroupCache(userId, upgradeGroup)
	}
	logParts := make([]string, 0, 2)
	if result.Quota > 0 {
		logParts = append(logParts, fmt.Sprintf("充值 %s", logger.LogQuota(result.Quota)))
	}
	if result.Subscription != nil {
		logParts = append(logParts, fmt.Sprintf("兑换订阅 %s", result.Subscription.SubscriptionPlanTitle))
	}
	if len(logParts) == 0 {
		logParts = append(logParts, "完成兑换")
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码%s，兑换码ID %d", strings.Join(logParts, "并"), redemption.Id))
	return result, nil
}

func (redemption *Redemption) Insert() error {
	insertData := map[string]interface{}{
		"user_id":                 redemption.UserId,
		"key":                     redemption.Key,
		"status":                  redemption.Status,
		"name":                    redemption.Name,
		"quota":                   redemption.Quota,
		"subscription_plan_id":    redemption.SubscriptionPlanId,
		"subscription_plan_title": redemption.SubscriptionPlanTitle,
		"created_time":            redemption.CreatedTime,
		"redeemed_time":           redemption.RedeemedTime,
		"used_user_id":            redemption.UsedUserId,
		"expired_time":            redemption.ExpiredTime,
	}
	if err := DB.Model(&Redemption{}).Create(insertData).Error; err != nil {
		return err
	}
	if redemption.Id == 0 && redemption.Key != "" {
		_ = DB.Model(&Redemption{}).Select("id").Where("key = ?", redemption.Key).First(redemption).Error
	}
	return nil
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "subscription_plan_id", "subscription_plan_title", "redeemed_time", "expired_time").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
