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

// ErrSubscriptionPurchaseLimit is returned when user has reached the max purchase limit for a plan
var ErrSubscriptionPurchaseLimit = errors.New("subscription.purchase_limit")

type Redemption struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int            `json:"status" gorm:"default:1"`
	Name         string         `json:"name" gorm:"index"`
	Quota        int            `json:"quota" gorm:"default:100"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	Count        int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId   int            `json:"used_user_id"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
	// 兑换码类型：1=余额充值(默认), 2=订阅套餐, 3=联合兑换(余额+订阅)
	Type                 int    `json:"type" gorm:"type:int;default:1"`
	SubscriptionPlanId   int    `json:"subscription_plan_id" gorm:"type:int;default:0"`    // 订阅套餐ID，仅当type=2或3时有效
	UpgradeGroup         string `json:"upgrade_group" gorm:"type:varchar(64);default:''"` // 升级用户分组
	UpgradeGroupRollback *bool  `json:"upgrade_group_rollback" gorm:"default:true"`       // 到期后是否回退分组，默认true（到期回退）
}

// IsUpgradeGroupRollback returns the effective value of UpgradeGroupRollback (defaults to true if nil)
func (r *Redemption) IsUpgradeGroupRollback() bool {
	if r.UpgradeGroupRollback == nil {
		return true
	}
	return *r.UpgradeGroupRollback
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

type RedeemResult struct {
	Quota              int    `json:"quota"`
	Type               int    `json:"type"`                 // 1=余额充值, 2=订阅套餐, 3=联合兑换
	SubscriptionPlanId int    `json:"subscription_plan_id"` // 订阅套餐ID
	PlanTitle          string `json:"plan_title"`           // 订阅套餐名称
	UpgradeGroup       string `json:"upgrade_group"`        // 升级的用户分组
}

// redeemBindSubscriptionTx creates a subscription from a redemption code within an existing transaction.
// Handles upgrade_group and rollback logic without opening a nested transaction.
func redeemBindSubscriptionTx(tx *gorm.DB, userId int, redemption *Redemption, upgradeGroup string, rollback bool) error {
	plan, err := GetSubscriptionPlanById(redemption.SubscriptionPlanId)
	if err != nil {
		return fmt.Errorf("订阅激活失败: %w", err)
	}
	// Determine effective upgrade_group for the subscription record
	effectiveUpgradeGroup := upgradeGroup
	if effectiveUpgradeGroup == "" {
		// No override, use plan's own upgrade_group
	} else {
		// Override plan's upgrade_group with redemption's
		planCopy := *plan
		planCopy.UpgradeGroup = effectiveUpgradeGroup
		plan = &planCopy
	}

	source := fmt.Sprintf("通过兑换码激活，兑换码ID %d", redemption.Id)
	if redemption.Type == common.RedemptionTypeCombo {
		source = fmt.Sprintf("通过联合兑换码激活，兑换码ID %d", redemption.Id)
	}

	_, err = CreateUserSubscriptionFromPlanTx(tx, userId, plan, source)
	if err != nil {
		return fmt.Errorf("订阅激活失败: %w", err)
	}

	if !rollback && upgradeGroup != "" {
		// 永久升级：更新 base_level，订阅到期后 resolve 也会返回这个值
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("base_level", upgradeGroup).Error; err != nil {
			return err
		}
	}

	// Apply resolved group
	_, err = applyResolvedUserGroup(tx, userId)
	return err
}

func Redeem(key string, userId int) (*RedeemResult, error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	var resolvedGroup string
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

		upgradeGroup := strings.TrimSpace(redemption.UpgradeGroup)
		rollback := redemption.IsUpgradeGroupRollback()

		// 根据兑换码类型处理
		switch redemption.Type {
		case common.RedemptionTypeSubscription:
			// 订阅类型兑换码
			if redemption.SubscriptionPlanId <= 0 {
				return errors.New("兑换码配置错误：缺少订阅套餐ID")
			}
			if err := redeemBindSubscriptionTx(tx, userId, redemption, upgradeGroup, rollback); err != nil {
				return err
			}

		case common.RedemptionTypeCombo:
			// 联合兑换码：余额 + 订阅
			if redemption.SubscriptionPlanId <= 0 {
				return errors.New("兑换码配置错误：缺少订阅套餐ID")
			}
			// 先充值余额
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			if err := redeemBindSubscriptionTx(tx, userId, redemption, upgradeGroup, rollback); err != nil {
				return err
			}

		default:
			// 余额类型兑换码（默认）— type=1 无订阅，upgrade_group 始终永久升级
			err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
			if err != nil {
				return err
			}
			if upgradeGroup != "" {
				// 只更新 base_level（永久升级基准），再通过 resolve 决定最终 group
				// 避免覆盖用户当前更高级别的活跃订阅 group
				if err := tx.Model(&User{}).Where("id = ?", userId).Update("base_level", upgradeGroup).Error; err != nil {
					return err
				}
				if _, err := applyResolvedUserGroup(tx, userId); err != nil {
					return err
				}
			}
		}

		// 读取最终的用户分组用于缓存更新
		currentGroup, err := getUserGroupByIdTx(tx, userId)
		if err == nil {
			resolvedGroup = currentGroup
		}

		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		if errors.Is(err, ErrSubscriptionPurchaseLimit) {
			return nil, ErrSubscriptionPurchaseLimit
		}
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}

	// 更新用户分组缓存
	if resolvedGroup != "" {
		_ = UpdateUserGroupCache(userId, resolvedGroup)
	}

	result := &RedeemResult{
		Quota:        redemption.Quota,
		Type:         redemption.Type,
		UpgradeGroup: strings.TrimSpace(redemption.UpgradeGroup),
	}

	switch redemption.Type {
	case common.RedemptionTypeSubscription:
		result.SubscriptionPlanId = redemption.SubscriptionPlanId
		plan := &SubscriptionPlan{}
		if err := DB.Where("id = ?", redemption.SubscriptionPlanId).First(plan).Error; err == nil {
			result.PlanTitle = plan.Title
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码激活订阅套餐，兑换码ID %d", redemption.Id))
	case common.RedemptionTypeCombo:
		result.SubscriptionPlanId = redemption.SubscriptionPlanId
		plan := &SubscriptionPlan{}
		if err := DB.Where("id = ?", redemption.SubscriptionPlanId).First(plan).Error; err == nil {
			result.PlanTitle = plan.Title
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过联合兑换码充值 %s 并激活订阅套餐，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	default:
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	}
	return result, nil
}


func (redemption *Redemption) Insert() error {
	var err error
	err = DB.Select("user_id", "key", "status", "name", "quota", "created_time", "expired_time", "type", "subscription_plan_id", "upgrade_group", "upgrade_group_rollback").Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time", "type", "subscription_plan_id", "upgrade_group", "upgrade_group_rollback").Updates(redemption).Error
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
