package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ---------------------------------------------------------------------------
// Free 免费套餐（纯套餐模式的新用户兜底档）
//
// 注册（风控通过后）自动发放：$1 等值月池、全模型、1 个月有效、一次性不刷新。
// 全局模型权重表照常作用——$1 池调 Opus(×2.5) 实得约 $0.4 list，天然限量，
// 无需为 Free 单设模型范围。
// ---------------------------------------------------------------------------

// FreePlanTitle 是免费套餐的固定标题。运营侧不要重命名。
const FreePlanTitle = "Free"

// freePlanSeedKey 是 subscription_plans.seed_key 上的跨库唯一键，
// 保证多节点并发下 Free 种子行全局唯一（Rule 11）。
const freePlanSeedKey = "free"

// freePlanTotalUSD Free 档月池的美元等值额度
const freePlanTotalUSD = 1.0

// FreePlanGrant is the per-user grant claim for the Free plan. The primary
// key on user_id makes granting database-idempotent across nodes: whichever
// node inserts the claim first wins, everyone else no-ops.
type FreePlanGrant struct {
	UserId    int   `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	CreatedAt int64 `json:"created_at" gorm:"autoCreateTime"`
}

// EnsureFreePlanSeed 幂等确保 Free 套餐存在（懒加载：首次发放时创建，无需改
// main.go 启动流程）。enabled=false 使其不出现在购买列表，仅系统发放。
// seed_key 唯一索引保证跨节点并发创建也只留一行。
func EnsureFreePlanSeed() (*SubscriptionPlan, error) {
	if plan, err := findFreePlan(); err != nil {
		return nil, err
	} else if plan != nil {
		return plan, nil
	}

	totalAmount := int64(freePlanTotalUSD * common.QuotaPerUnit)
	seedKey := freePlanSeedKey
	plan := &SubscriptionPlan{
		Title:              FreePlanTitle,
		Subtitle:           "New user free tier",
		PriceAmount:        0,
		Currency:           "USD",
		DurationUnit:       "month",
		DurationValue:      1,
		Enabled:            false, // 不进购买列表，仅注册发放
		MaxPurchasePerUser: 1,
		TotalAmount:        totalAmount,
		Window5hAmount:     0, // Free 不启用短窗，月池即唯一闸
		WindowWeekAmount:   0,
		QuotaResetPeriod:   SubscriptionResetNever, // 一次性，不随周期刷新
		SeedKey:            &seedKey,
	}
	plan.NormalizeDefaults()
	insert := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(plan)
	if insert.Error != nil || insert.RowsAffected == 0 {
		// 唯一键冲突（并发节点已建）或其它失败：回读现有种子行
		if existing, err2 := findFreePlan(); err2 == nil && existing != nil {
			return existing, nil
		}
		if insert.Error != nil {
			return nil, insert.Error
		}
		return nil, errors.New("free plan seed insert conflicted but row not found")
	}
	// Enabled 带 gorm default:true，Create 零值 false 会被默认值覆盖，建后显式关闭
	if err := DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("enabled", false).Error; err != nil {
		return nil, err
	}
	plan.Enabled = false
	InvalidateSubscriptionPlanCache(plan.Id)
	return plan, nil
}

func findFreePlan() (*SubscriptionPlan, error) {
	var plan SubscriptionPlan
	query := DB.Where("seed_key = ?", freePlanSeedKey).Limit(1).Find(&plan)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected > 0 {
		return &plan, nil
	}
	// Legacy row created before seed_key existed: adopt and backfill it.
	query = DB.Where("title = ? AND price_amount = 0", FreePlanTitle).
		Order("id asc").Limit(1).Find(&plan)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	if err := DB.Model(&SubscriptionPlan{}).
		Where("id = ? AND seed_key IS NULL", plan.Id).
		Update("seed_key", freePlanSeedKey).Error; err != nil {
		// 并发下另一节点可能已给别的行占了 seed_key：以唯一键持有者为准
		var seeded SubscriptionPlan
		q := DB.Where("seed_key = ?", freePlanSeedKey).Limit(1).Find(&seeded)
		if q.Error == nil && q.RowsAffected > 0 {
			return &seeded, nil
		}
		return nil, err
	}
	return &plan, nil
}

// GrantFreePlanToUser 给用户发放 Free 套餐。幂等：free_plan_grants 主键 claim
// 保证同一用户跨节点并发调用也只发一次（claim 与订阅创建同事务，失败即回滚）。
// 调用方约定：必须在注册风控（域名/IP/邮箱）通过之后调用；风险注册不发放。
func GrantFreePlanToUser(userId int) error {
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	plan, err := EnsureFreePlanSeed()
	if err != nil {
		return err
	}
	granted := false
	err = DB.Transaction(func(tx *gorm.DB) error {
		claim := tx.Clauses(clause.OnConflict{DoNothing: true}).
			Create(&FreePlanGrant{UserId: userId})
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			// 已发过（本节点或其它节点），幂等成功
			return nil
		}
		granted = true
		_, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "free")
		return err
	})
	if err != nil {
		return err
	}
	if granted {
		RecordLog(userId, LogTypeSystem, fmt.Sprintf("新用户获得 %s 免费套餐（$%.0f 等值额度，1 个月有效）", FreePlanTitle, freePlanTotalUSD))
	}
	return nil
}
