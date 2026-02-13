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

// redeemBusinessError
// model 层用类型断言区分业务错误和系统错误，controller 层用 errors.As 提取后做 i18n 映射
type redeemBusinessError struct{ msg string }

func (e redeemBusinessError) Error() string { return e.msg }

var (
	ErrRedemptionInvalid      = redeemBusinessError{"redemption.invalid"}
	ErrRedemptionUsed         = redeemBusinessError{"redemption.used"}
	ErrRedemptionExpired      = redeemBusinessError{"redemption.expired"}
	ErrRedemptionTypeInvalid  = redeemBusinessError{"redemption.type_invalid"}
	ErrRedemptionPlanNotFound = redeemBusinessError{"redemption.plan_not_found"}
	ErrRedemptionPlanDisabled = redeemBusinessError{"redemption.plan_disabled"}
)

// IsRedeemBusinessError 通过类型断言判断是否为兑换业务错误
func IsRedeemBusinessError(err error) bool {
	var target redeemBusinessError
	return errors.As(err, &target)
}

const (
	RedemptionTypeQuota        = "quota"
	RedemptionTypeSubscription = "subscription"
)

// ParseRedemptionType When raw is empty, defaults to quota; otherwise, it's subscription.
func ParseRedemptionType(raw string) (string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	switch normalized {
	case "", RedemptionTypeQuota:
		return RedemptionTypeQuota, true
	case RedemptionTypeSubscription:
		return RedemptionTypeSubscription, true
	default:
		return "", false
	}
}

type Redemption struct {
	Id                 int            `json:"id"`
	UserId             int            `json:"user_id"`
	Key                string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status             int            `json:"status" gorm:"default:1"`
	Name               string         `json:"name" gorm:"index"`
	Quota              int            `json:"quota"`
	RedeemType         string         `json:"redeem_type" gorm:"type:varchar(32);not null;default:'quota';index"`
	SubscriptionPlanId int            `json:"subscription_plan_id" gorm:"default:0;index"`
	CreatedTime        int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime       int64          `json:"redeemed_time" gorm:"bigint"`
	Count              int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId         int            `json:"used_user_id"`
	DeletedAt          gorm.DeletedAt `gorm:"index"`
	ExpiredTime        int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedeemSubscriptionInfo struct {
	PlanId    int    `json:"plan_id"`
	PlanTitle string `json:"plan_title"`
	StartTime int64  `json:"start_time"`
	EndTime   int64  `json:"end_time"`
}

type RedeemResult struct {
	RedeemType   string                  `json:"redeem_type"`
	QuotaAdded   int                     `json:"quota_added"`
	Subscription *RedeemSubscriptionInfo `json:"subscription,omitempty"`
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

func Redeem(key string, userId int) (result *RedeemResult, err error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}
	result = &RedeemResult{
		RedeemType: RedemptionTypeQuota,
		QuotaAdded: 0,
	}
	cacheUpgradeGroup := ""

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRedemptionInvalid
			}
			return err
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return ErrRedemptionUsed
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return ErrRedemptionExpired
		}
		redeemType, ok := ParseRedemptionType(redemption.RedeemType)
		if !ok {
			return ErrRedemptionTypeInvalid
		}
		result.RedeemType = redeemType
		if redeemType == RedemptionTypeSubscription {
			if redemption.SubscriptionPlanId <= 0 {
				return ErrRedemptionPlanNotFound
			}
			plan, planErr := getSubscriptionPlanByIdTx(tx, redemption.SubscriptionPlanId)
			if planErr != nil {
				if errors.Is(planErr, gorm.ErrRecordNotFound) {
					return ErrRedemptionPlanNotFound
				}
				return planErr
			}
			if plan == nil {
				return ErrRedemptionPlanNotFound
			}
			if !plan.Enabled {
				return ErrRedemptionPlanDisabled
			}
			sub, createErr := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if createErr != nil {
				if errors.Is(createErr, ErrSubscriptionPurchaseLimit) {
					return ErrSubscriptionPurchaseLimit
				}
				return createErr
			}
			result.Subscription = &RedeemSubscriptionInfo{
				PlanId:    plan.Id,
				PlanTitle: plan.Title,
				StartTime: sub.StartTime,
				EndTime:   sub.EndTime,
			}
			result.QuotaAdded = 0
			cacheUpgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		} else {
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			result.QuotaAdded = redemption.Quota
		}
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		if IsRedeemBusinessError(err) {
			return nil, err
		}
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if cacheUpgradeGroup != "" {
		err := UpdateUserGroupCache(userId, cacheUpgradeGroup)
		if err != nil {
			common.SysError("failed to update user group cache: " + err.Error())
		}
	}
	if result.RedeemType == RedemptionTypeSubscription {
		planTitle := ""
		if result.Subscription != nil {
			planTitle = result.Subscription.PlanTitle
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码开通订阅 %s，兑换码ID %d", planTitle, redemption.Id))
		return result, nil
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(result.QuotaAdded), redemption.Id))
	return result, nil
}

func (redemption *Redemption) Insert() error {
	var err error
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
	err = DB.Model(redemption).Select("name", "status", "quota", "subscription_plan_id", "redeemed_time", "expired_time").Updates(redemption).Error
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
