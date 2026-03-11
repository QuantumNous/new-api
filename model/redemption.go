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

const (
	RedemptionTypeQuota        = "quota"
	RedemptionTypeSubscription = "subscription"
)

var (
	redemptionUserGroupCacheUpdater = UpdateUserGroupCache
	redemptionUserCacheInvalidator  = invalidateUserCache
)

type Redemption struct {
	Id     int    `json:"id"`
	UserId int    `json:"user_id"`
	Key    string `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status int    `json:"status" gorm:"default:1"`
	Name   string `json:"name" gorm:"index"`
	Quota  int    `json:"quota" gorm:"default:100"`
	// RedemptionType decides whether the code tops up quota or activates a subscription plan.
	RedemptionType string `json:"redemption_type" gorm:"type:varchar(16);not null;default:'quota';index"`
	// SubscriptionPlanId is only used when RedemptionType is subscription.
	SubscriptionPlanId int                   `json:"subscription_plan_id" gorm:"default:0;index"`
	CreatedTime        int64                 `json:"created_time" gorm:"bigint"`
	RedeemedTime       int64                 `json:"redeemed_time" gorm:"bigint"`
	Count              int                   `json:"count" gorm:"-:all"` // only for api request
	UsedUserId         int                   `json:"used_user_id"`
	SubscriptionPlan   *SubscriptionPlanInfo `json:"subscription_plan,omitempty" gorm:"-:all"`
	DeletedAt          gorm.DeletedAt        `gorm:"index"`
	ExpiredTime        int64                 `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedeemResult struct {
	RedemptionType   string                `json:"redemption_type"`
	Quota            int                   `json:"quota"`
	Subscription     *UserSubscription     `json:"subscription,omitempty"`
	SubscriptionPlan *SubscriptionPlanInfo `json:"subscription_plan,omitempty"`
}

func NormalizeRedemptionType(redemptionType string) string {
	switch strings.TrimSpace(redemptionType) {
	case RedemptionTypeSubscription:
		return RedemptionTypeSubscription
	default:
		return RedemptionTypeQuota
	}
}

func (redemption *Redemption) normalizeForWrite() {
	if redemption == nil {
		return
	}
	redemption.RedemptionType = NormalizeRedemptionType(redemption.RedemptionType)
	if redemption.RedemptionType == RedemptionTypeSubscription {
		redemption.Quota = 0
		return
	}
	redemption.SubscriptionPlanId = 0
}

func buildSubscriptionPlanInfo(plan *SubscriptionPlan) *SubscriptionPlanInfo {
	if plan == nil {
		return nil
	}
	return &SubscriptionPlanInfo{
		PlanId:    plan.Id,
		PlanTitle: plan.Title,
	}
}

func attachSubscriptionPlanInfo(redemptions []*Redemption) error {
	for _, redemption := range redemptions {
		if redemption == nil {
			continue
		}
		if redemption.SubscriptionPlanId <= 0 || NormalizeRedemptionType(redemption.RedemptionType) != RedemptionTypeSubscription {
			continue
		}
		plan, err := GetSubscriptionPlanById(redemption.SubscriptionPlanId)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return err
		}
		redemption.SubscriptionPlan = buildSubscriptionPlanInfo(plan)
	}
	return nil
}

func syncRedemptionUserGroupCache(userId int, upgradeGroup string, redemptionId int, subscriptionId int) {
	upgradeGroup = strings.TrimSpace(upgradeGroup)
	if upgradeGroup == "" {
		return
	}
	if err := redemptionUserGroupCacheUpdater(userId, upgradeGroup); err != nil {
		common.SysLog(fmt.Sprintf("failed to update redemption user group cache: userId=%d upgradeGroup=%s redemptionId=%d subscriptionId=%d err=%s", userId, upgradeGroup, redemptionId, subscriptionId, err.Error()))
		if invalidateErr := redemptionUserCacheInvalidator(userId); invalidateErr != nil {
			common.SysLog(fmt.Sprintf("failed to invalidate user cache after redemption group cache update failure: userId=%d redemptionId=%d subscriptionId=%d err=%s", userId, redemptionId, subscriptionId, invalidateErr.Error()))
		}
	}
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
	if err = attachSubscriptionPlanInfo(redemptions); err != nil {
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
	if err = attachSubscriptionPlanInfo(redemptions); err != nil {
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
	if err != nil {
		return nil, err
	}
	if err = attachSubscriptionPlanInfo([]*Redemption{&redemption}); err != nil {
		return nil, err
	}
	return &redemption, err
}

func Redeem(key string, userId int) (result *RedeemResult, err error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	result = &RedeemResult{}
	redemption := &Redemption{}
	var upgradeGroup string

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
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
		redemption.normalizeForWrite()
		result.RedemptionType = redemption.RedemptionType
		switch redemption.RedemptionType {
		case RedemptionTypeSubscription:
			if redemption.SubscriptionPlanId <= 0 {
				return errors.New("兑换码未绑定订阅套餐")
			}
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.SubscriptionPlanId)
			if err != nil {
				return err
			}
			subscription, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				return err
			}
			result.Subscription = subscription
			result.SubscriptionPlan = buildSubscriptionPlanInfo(plan)
			upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		default:
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			result.Quota = redemption.Quota
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
		subscriptionId := 0
		if result.Subscription != nil {
			subscriptionId = result.Subscription.Id
		}
		syncRedemptionUserGroupCache(userId, upgradeGroup, redemption.Id, subscriptionId)
	}
	switch result.RedemptionType {
	case RedemptionTypeSubscription:
		planTitle := ""
		if result.SubscriptionPlan != nil {
			planTitle = result.SubscriptionPlan.PlanTitle
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码激活订阅 %s，兑换码ID %d", planTitle, redemption.Id))
	default:
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	}
	return result, nil
}

func (redemption *Redemption) Insert() error {
	var err error
	redemption.normalizeForWrite()
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	redemption.normalizeForWrite()
	err = DB.Model(redemption).Select("name", "status", "quota", "redemption_type", "subscription_plan_id", "redeemed_time", "expired_time").Updates(redemption).Error
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
