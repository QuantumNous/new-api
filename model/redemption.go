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

const (
	RedemptionTypeQuota        = "quota"
	RedemptionTypeSubscription = "subscription"
	RedemptionTypeRegistration = "registration"
)

type Redemption struct {
	Id                    int            `json:"id"`
	UserId                int            `json:"user_id"`
	Key                   string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status                int            `json:"status" gorm:"default:1"`
	Name                  string         `json:"name" gorm:"index"`
	Type                  string         `json:"type" gorm:"type:varchar(32);default:'quota';index"`
	Quota                 int            `json:"quota" gorm:"default:100"`
	SubscriptionPlanId    int            `json:"subscription_plan_id" gorm:"default:0;index"`
	SubscriptionPlanTitle string         `json:"subscription_plan_title,omitempty" gorm:"-"`
	CreatedTime           int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime          int64          `json:"redeemed_time" gorm:"bigint"`
	Count                 int            `json:"count" gorm:"-:all"`               // only for api request
	MaxRedemptions        int            `json:"max_redemptions" gorm:"default:0"` // 兑换次数上限，0 表示不限次数
	RedeemedCount         int            `json:"redeemed_count" gorm:"default:0"`  // 已兑换次数
	UsedUserId            int            `json:"used_user_id"`
	DeletedAt             gorm.DeletedAt `gorm:"index"`
	ExpiredTime           int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedemptionRedeemResult struct {
	Type               string            `json:"type"`
	Quota              int               `json:"quota,omitempty"`
	RedemptionId       int               `json:"redemption_id"`
	Subscription       *UserSubscription `json:"subscription,omitempty"`
	SubscriptionPlan   *SubscriptionPlan `json:"subscription_plan,omitempty"`
	SubscriptionPlanId int               `json:"subscription_plan_id,omitempty"`
}

func NormalizeRedemptionType(redemptionType string) string {
	redemptionType = strings.TrimSpace(redemptionType)
	if redemptionType == "" {
		return RedemptionTypeQuota
	}
	return redemptionType
}

func IsValidRedemptionType(redemptionType string) bool {
	switch NormalizeRedemptionType(redemptionType) {
	case RedemptionTypeQuota, RedemptionTypeSubscription, RedemptionTypeRegistration:
		return true
	default:
		return false
	}
}

func redemptionUnavailableError(redemption *Redemption) error {
	if redemption != nil && redemption.MaxRedemptions > 0 && redemption.RedeemedCount >= redemption.MaxRedemptions {
		return ErrRedemptionExhausted
	}
	return ErrRedemptionUsed
}

func isUserFacingRedemptionError(err error) bool {
	return errors.Is(err, ErrRedemptionInvalid) ||
		errors.Is(err, ErrRedemptionUsed) ||
		errors.Is(err, ErrRedemptionExpired) ||
		errors.Is(err, ErrRedemptionNotProvided) ||
		errors.Is(err, ErrRedemptionExhausted)
}

func populateRedemptionPlanTitles(tx *gorm.DB, redemptions []*Redemption) {
	if tx == nil || len(redemptions) == 0 {
		return
	}
	ids := make([]int, 0)
	seen := make(map[int]bool)
	for _, redemption := range redemptions {
		if redemption == nil || NormalizeRedemptionType(redemption.Type) != RedemptionTypeSubscription || redemption.SubscriptionPlanId <= 0 {
			continue
		}
		if !seen[redemption.SubscriptionPlanId] {
			seen[redemption.SubscriptionPlanId] = true
			ids = append(ids, redemption.SubscriptionPlanId)
		}
	}
	if len(ids) == 0 {
		return
	}
	var plans []SubscriptionPlan
	if err := tx.Where("id IN ?", ids).Find(&plans).Error; err != nil {
		return
	}
	titles := make(map[int]string, len(plans))
	for _, plan := range plans {
		titles[plan.Id] = plan.Title
	}
	for _, redemption := range redemptions {
		if redemption != nil {
			redemption.SubscriptionPlanTitle = titles[redemption.SubscriptionPlanId]
		}
	}
}

func applyRedemptionTypeFilter(query *gorm.DB, redemptionType string) *gorm.DB {
	redemptionType = strings.TrimSpace(redemptionType)
	if redemptionType == "" || !IsValidRedemptionType(redemptionType) {
		return query
	}
	redemptionType = NormalizeRedemptionType(redemptionType)
	typeCol := "`type`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		typeCol = `"type"`
	}
	if redemptionType == RedemptionTypeQuota {
		return query.Where(typeCol+" = ? OR "+typeCol+" = '' OR "+typeCol+" IS NULL", RedemptionTypeQuota)
	}
	return query.Where(typeCol+" = ?", redemptionType)
}

const redemptionMaxRedemptionsMigrationOptionKey = "RedemptionMaxRedemptionsMigratedV1"

func MigrateRedemptionMaxRedemptionsOnce() error {
	var existing Option
	err := DB.Where("key = ?", redemptionMaxRedemptionsMigrationOptionKey).First(&existing).Error
	if err == nil && existing.Value == "true" {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var option Option
		err := tx.Where("key = ?", redemptionMaxRedemptionsMigrationOptionKey).First(&option).Error
		if err == nil && option.Value == "true" {
			return nil
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Model(&Redemption{}).Where("max_redemptions = ?", 0).Update("max_redemptions", 1).Error; err != nil {
			return err
		}
		option = Option{Key: redemptionMaxRedemptionsMigrationOptionKey, Value: "true"}
		if err := tx.FirstOrCreate(&option, Option{Key: redemptionMaxRedemptionsMigrationOptionKey}).Error; err != nil {
			return err
		}
		return tx.Model(&Option{}).Where("key = ?", redemptionMaxRedemptionsMigrationOptionKey).Update("value", "true").Error
	})
}

func GetAllRedemptions(startIdx int, num int, redemptionType string) (redemptions []*Redemption, total int64, err error) {
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
	query := applyRedemptionTypeFilter(tx.Model(&Redemption{}), redemptionType)
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	populateRedemptionPlanTitles(tx, redemptions)

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, startIdx int, num int, redemptionType string) (redemptions []*Redemption, total int64, err error) {
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
	query := applyRedemptionTypeFilter(tx.Model(&Redemption{}), redemptionType)
	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}

	// Only try to convert to ID if the string represents a valid integer
	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ? OR "+keyCol+" LIKE ?", id, keyword+"%", keyword+"%")
	} else {
		query = query.Where("name LIKE ? OR "+keyCol+" LIKE ?", keyword+"%", keyword+"%")
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
	populateRedemptionPlanTitles(tx, redemptions)

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
	if err == nil {
		populateRedemptionPlanTitles(DB, []*Redemption{&redemption})
	}
	return &redemption, err
}

func Redeem(key string, userId int) (result *RedemptionRedeemResult, err error) {
	return RedeemWithPurchaseMode(key, userId, SubscriptionPurchaseModeConcurrent)
}

func RedeemWithPurchaseMode(key string, userId int, purchaseMode string) (result *RedemptionRedeemResult, err error) {
	if key == "" {
		return nil, ErrRedemptionNotProvided
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	purchaseMode = NormalizeSubscriptionPurchaseMode(purchaseMode)
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRedemptionInvalid
			}
			return err
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return redemptionUnavailableError(redemption)
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return ErrRedemptionExpired
		}
		if redemption.MaxRedemptions < 0 {
			return errors.New("无效的兑换次数")
		}
		if redemption.MaxRedemptions > 0 && redemption.RedeemedCount >= redemption.MaxRedemptions {
			if err := tx.Model(&Redemption{}).
				Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
				Update("status", common.RedemptionCodeStatusUsed).Error; err != nil {
				return err
			}
			return ErrRedemptionExhausted
		}
		redemption.Type = NormalizeRedemptionType(redemption.Type)
		result = &RedemptionRedeemResult{
			Type:               redemption.Type,
			RedemptionId:       redemption.Id,
			SubscriptionPlanId: redemption.SubscriptionPlanId,
		}
		switch redemption.Type {
		case RedemptionTypeQuota:
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			result.Quota = redemption.Quota
		case RedemptionTypeSubscription:
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.SubscriptionPlanId)
			if err != nil {
				return errors.New("无效的套餐")
			}
			if !plan.Enabled {
				return errors.New("该套餐已禁用")
			}
			subscription, err := CreateUserSubscriptionFromPlanWithModeTx(tx, userId, plan, "redemption", purchaseMode)
			if err != nil {
				return err
			}
			result.SubscriptionPlan = plan
			result.Subscription = subscription
		case RedemptionTypeRegistration:
			return ErrRedemptionInvalid
		default:
			return errors.New("无效的兑换码类型")
		}
		now := common.GetTimestamp()
		newRedeemedCount := redemption.RedeemedCount + 1
		nextStatus := common.RedemptionCodeStatusEnabled
		if redemption.MaxRedemptions > 0 && newRedeemedCount >= redemption.MaxRedemptions {
			nextStatus = common.RedemptionCodeStatusUsed
		}
		updateResult := tx.Model(&Redemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]interface{}{
				"redeemed_time":  now,
				"status":         nextStatus,
				"used_user_id":   userId,
				"redeemed_count": newRedeemedCount,
			})
		if updateResult.Error != nil {
			return updateResult.Error
		}
		if updateResult.RowsAffected != 1 {
			var latest Redemption
			if latestErr := tx.First(&latest, "id = ?", redemption.Id).Error; latestErr == nil {
				return redemptionUnavailableError(&latest)
			}
			return ErrRedemptionUsed
		}
		redemption.RedeemedTime = now
		redemption.Status = nextStatus
		redemption.UsedUserId = userId
		redemption.RedeemedCount = newRedeemedCount
		return nil
	})
	if err != nil {
		if isUserFacingRedemptionError(err) {
			return nil, err
		}
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if result != nil && result.Type == RedemptionTypeSubscription && result.SubscriptionPlan != nil {
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码兑换套餐 %s，兑换码ID %d", result.SubscriptionPlan.Title, redemption.Id))
		if result.Subscription != nil {
			emitSubscriptionCompleted(SubscriptionCompletedEvent{
				UserId:             userId,
				SubscriptionId:     result.Subscription.Id,
				PlanId:             result.SubscriptionPlan.Id,
				PlanTitle:          result.SubscriptionPlan.Title,
				AmountTotal:        result.Subscription.AmountTotal,
				StartTime:          result.Subscription.StartTime,
				EndTime:            result.Subscription.EndTime,
				NextResetTime:      result.Subscription.NextResetTime,
				ResetPeriod:        NormalizeResetPeriod(result.SubscriptionPlan.QuotaResetPeriod),
				PaymentMethod:      "redemption",
				PaymentProvider:    "redemption",
				SubscriptionSource: result.Subscription.Source,
			})
		}
		return result, nil
	}
	if result != nil && result.Type == RedemptionTypeQuota && result.Quota > 0 {
		common.ResetQuotaNotificationSendLocks(userId, "wallet", 0)
		syncCreditUserQuotaCache(userId, result.Quota, "redemption")
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return result, nil
}

func (redemption *Redemption) Insert() error {
	if NormalizeRedemptionType(redemption.Type) != RedemptionTypeRegistration {
		return DB.Create(redemption).Error
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(redemption).Error; err != nil {
			return err
		}
		if err := tx.Model(redemption).Updates(map[string]interface{}{
			"quota":                0,
			"subscription_plan_id": 0,
		}).Error; err != nil {
			return err
		}
		redemption.Quota = 0
		redemption.SubscriptionPlanId = 0
		return nil
	})
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "type", "quota", "subscription_plan_id", "redeemed_time", "expired_time", "max_redemptions").Updates(redemption).Error
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
	result := DB.Where(
		"status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?) OR (status = ? AND max_redemptions > 0 AND redeemed_count >= max_redemptions)",
		[]int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled},
		common.RedemptionCodeStatusEnabled,
		now,
		common.RedemptionCodeStatusEnabled,
	).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
