package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

// ErrSubscriptionPurchaseLimit is returned when user has reached the max purchase limit for a plan
var ErrSubscriptionPurchaseLimit = errors.New("subscription.purchase_limit")

// 兑换限领 / 计数相关错误（透传给用户，不被 ErrRedeemFailed 吞掉）。
var (
	ErrRedeemClaimedByKey = errors.New("您已兑换过该兑换码，每人限领一次")
	ErrRedeemClaimedByTag = errors.New("您已兑换过该批次的兑换码，每人限领一次")
	ErrRedeemUsedUp       = errors.New("该兑换码兑换次数已用完")
	ErrRedeemRateLimited  = errors.New("操作过于频繁，请稍后再试")
)

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
	// 双钱包拆分新增字段
	Tag       string `json:"tag" gorm:"type:varchar(64);index"` // 批次标签，空=无批次
	MaxUses   int    `json:"max_uses" gorm:"default:1"`         // 最大可兑换次数，1=一次性
	UsedCount int    `json:"used_count" gorm:"default:0"`       // 已兑换次数
	ValidDays int    `json:"valid_days" gorm:"default:0"`       // 兑换后额度有效天数，0=不过期(进充值钱包)
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

	// 同批次限领：对 (tag, userId) 加 Redis 锁，串行化同一用户对同 tag 的并发兑换，
	// 解决"不同码锁不同行、HasClaimedByTag 互相看不见"的 check-then-insert 竞态。
	var lockKey string
	if common.RedisEnabled {
		var preTag string
		if err := DB.Model(&Redemption{}).Where(keyCol+" = ?", key).Select("tag").Scan(&preTag).Error; err == nil {
			preTag = strings.TrimSpace(preTag)
			if preTag != "" {
				lockKey = fmt.Sprintf("redeem_claim_lock:%s:%d", preTag, userId)
				ok, lockErr := common.RedisSetNX(lockKey, "1", 5*time.Second)
				if lockErr == nil && !ok {
					return nil, ErrRedeemRateLimited
				}
			}
		}
	}
	defer func() {
		if lockKey != "" {
			common.RedisDel(lockKey)
		}
	}()

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

		// 双钱包拆分：计数模型 —— 校验剩余可兑换次数（MaxUses<=0 视为一次性）。
		maxUses := redemption.MaxUses
		if maxUses <= 0 {
			maxUses = 1
		}
		if redemption.UsedCount >= maxUses {
			return ErrRedeemUsedUp
		}

		// 限领校验：同码一人一次 & 同批次(tag)一人一次。
		if claimed, e := HasClaimedByKey(tx, userId, redemption.Key); e != nil {
			return e
		} else if claimed {
			return ErrRedeemClaimedByKey
		}
		tag := strings.TrimSpace(redemption.Tag)
		if tag != "" {
			if claimed, e := HasClaimedByTag(tx, userId, tag); e != nil {
				return e
			} else if claimed {
				return ErrRedeemClaimedByTag
			}
		}

		upgradeGroup := strings.TrimSpace(redemption.UpgradeGroup)
		rollback := redemption.IsUpgradeGroupRollback()

		// creditQuotaTx 按 valid_days 决定余额入账钱包：>0 进免费钱包（带过期明细），否则进充值钱包。
		creditQuotaTx := func(amount int) error {
			if amount <= 0 {
				return nil
			}
			if redemption.ValidDays > 0 {
				expiredTime := common.GetTimestamp() + int64(redemption.ValidDays)*86400
				return AddFreeQuota(tx, userId, amount, FreeQuotaSourceRedemption, redemption.Id, expiredTime)
			}
			return AddRechargeQuota(tx, userId, amount)
		}

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
			// 先充值余额（按 valid_days 分流钱包）
			if err = creditQuotaTx(redemption.Quota); err != nil {
				return err
			}
			if err := redeemBindSubscriptionTx(tx, userId, redemption, upgradeGroup, rollback); err != nil {
				return err
			}

		default:
			// 余额类型兑换码（默认）— type=1 无订阅，upgrade_group 始终永久升级
			if err = creditQuotaTx(redemption.Quota); err != nil {
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

		// 写限领记录（同码 / 同批次 一人一次）。
		if err := insertRedemptionClaim(tx, userId, redemption.Id, redemption.Key, tag); err != nil {
			return err
		}

		// 计数模型：递增已用次数；达到上限才整体置为已用状态。
		redemption.UsedCount++
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.UsedUserId = userId
		if redemption.UsedCount >= maxUses {
			redemption.Status = common.RedemptionCodeStatusUsed
		}
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		if errors.Is(err, ErrSubscriptionPurchaseLimit) {
			return nil, ErrSubscriptionPurchaseLimit
		}
		// 限领 / 次数用尽 / 限频错误透传给用户明确文案。
		if errors.Is(err, ErrRedeemClaimedByKey) || errors.Is(err, ErrRedeemClaimedByTag) || errors.Is(err, ErrRedeemUsedUp) || errors.Is(err, ErrRedeemRateLimited) {
			return nil, err
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
	err = DB.Select("user_id", "key", "status", "name", "quota", "created_time", "expired_time", "type", "subscription_plan_id", "upgrade_group", "upgrade_group_rollback", "tag", "max_uses", "used_count", "valid_days").Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time", "type", "subscription_plan_id", "upgrade_group", "upgrade_group_rollback", "tag", "max_uses", "valid_days").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	// 双钱包拆分：级联清理限领记录。
	// 单码删除清该码的 key claim；若该码带 tag 且删除后该 tag 下已无其它兑换码，
	// 则一并清理该 tag 的批次限领记录（限领记录保留至标签被删除为止）。
	return DB.Transaction(func(tx *gorm.DB) error {
		tag := strings.TrimSpace(redemption.Tag)
		key := redemption.Key
		if err := tx.Delete(redemption).Error; err != nil {
			return err
		}
		if key != "" {
			if err := DeleteRedemptionClaimsByKey(tx, key); err != nil {
				return err
			}
		}
		if tag != "" {
			var remaining int64
			if err := tx.Model(&Redemption{}).Where("tag = ?", tag).Count(&remaining).Error; err != nil {
				return err
			}
			if remaining == 0 {
				if err := DeleteRedemptionClaimsByTag(tx, tag); err != nil {
					return err
				}
			}
		}
		return nil
	})
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

func DeleteRedemptionsByIds(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 为空")
	}
	var deleted int64
	for _, id := range ids {
		if err := DeleteRedemptionById(id); err != nil {
			common.SysError("failed to delete redemption " + strconv.Itoa(id) + ": " + err.Error())
			continue
		}
		deleted++
	}
	return deleted, nil
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
