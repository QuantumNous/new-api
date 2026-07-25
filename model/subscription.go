package model

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/samber/hot"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Subscription duration units
const (
	SubscriptionDurationYear   = "year"
	SubscriptionDurationMonth  = "month"
	SubscriptionDurationDay    = "day"
	SubscriptionDurationHour   = "hour"
	SubscriptionDurationCustom = "custom"
)

// Subscription quota reset period
const (
	SubscriptionResetNever   = "never"
	SubscriptionResetDaily   = "daily"
	SubscriptionResetWeekly  = "weekly"
	SubscriptionResetMonthly = "monthly"
	SubscriptionResetCustom  = "custom"
)

var (
	ErrSubscriptionOrderNotFound                = errors.New("subscription order not found")
	ErrSubscriptionOrderStatusInvalid           = errors.New("subscription order status invalid")
	ErrSubscriptionTierRankReserved             = errors.New("subscription tier rank reserved")
	ErrSubscriptionTierRankRequired             = errors.New("subscription tier rank required")
	ErrSubscriptionPlanLifecycleFieldsImmutable = errors.New("subscription plan lifecycle fields immutable")
)

const (
	subscriptionPlanCacheNamespace     = "new-api:subscription_plan:v1"
	subscriptionPlanInfoCacheNamespace = "new-api:subscription_plan_info:v1"
)

var (
	subscriptionPlanCacheOnce     sync.Once
	subscriptionPlanInfoCacheOnce sync.Once

	subscriptionPlanCache     *cachex.HybridCache[SubscriptionPlan]
	subscriptionPlanInfoCache *cachex.HybridCache[SubscriptionPlanInfo]
)

func subscriptionPlanCacheTTL() time.Duration {
	ttlSeconds := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_CACHE_TTL", 300)
	if ttlSeconds <= 0 {
		ttlSeconds = 300
	}
	return time.Duration(ttlSeconds) * time.Second
}

func subscriptionPlanInfoCacheTTL() time.Duration {
	ttlSeconds := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_INFO_CACHE_TTL", 120)
	if ttlSeconds <= 0 {
		ttlSeconds = 120
	}
	return time.Duration(ttlSeconds) * time.Second
}

func subscriptionPlanCacheCapacity() int {
	capacity := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_CACHE_CAP", 5000)
	if capacity <= 0 {
		capacity = 5000
	}
	return capacity
}

func subscriptionPlanInfoCacheCapacity() int {
	capacity := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_INFO_CACHE_CAP", 10000)
	if capacity <= 0 {
		capacity = 10000
	}
	return capacity
}

func getSubscriptionPlanCache() *cachex.HybridCache[SubscriptionPlan] {
	subscriptionPlanCacheOnce.Do(func() {
		ttl := subscriptionPlanCacheTTL()
		subscriptionPlanCache = cachex.NewHybridCache[SubscriptionPlan](cachex.HybridCacheConfig[SubscriptionPlan]{
			Namespace: cachex.Namespace(subscriptionPlanCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[SubscriptionPlan]{},
			Memory: func() *hot.HotCache[string, SubscriptionPlan] {
				return hot.NewHotCache[string, SubscriptionPlan](hot.LRU, subscriptionPlanCacheCapacity()).
					WithTTL(ttl).
					WithJanitor().
					Build()
			},
		})
	})
	return subscriptionPlanCache
}

func getSubscriptionPlanInfoCache() *cachex.HybridCache[SubscriptionPlanInfo] {
	subscriptionPlanInfoCacheOnce.Do(func() {
		ttl := subscriptionPlanInfoCacheTTL()
		subscriptionPlanInfoCache = cachex.NewHybridCache[SubscriptionPlanInfo](cachex.HybridCacheConfig[SubscriptionPlanInfo]{
			Namespace: cachex.Namespace(subscriptionPlanInfoCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[SubscriptionPlanInfo]{},
			Memory: func() *hot.HotCache[string, SubscriptionPlanInfo] {
				return hot.NewHotCache[string, SubscriptionPlanInfo](hot.LRU, subscriptionPlanInfoCacheCapacity()).
					WithTTL(ttl).
					WithJanitor().
					Build()
			},
		})
	})
	return subscriptionPlanInfoCache
}

func subscriptionPlanCacheKey(id int) string {
	if id <= 0 {
		return ""
	}
	return strconv.Itoa(id)
}

func InvalidateSubscriptionPlanCache(planId int) {
	if planId <= 0 {
		return
	}
	cache := getSubscriptionPlanCache()
	_, _ = cache.DeleteMany([]string{subscriptionPlanCacheKey(planId)})
	infoCache := getSubscriptionPlanInfoCache()
	_ = infoCache.Purge()
}

func invalidateSubscriptionPlanCacheOnSuccess(planId int, err error) error {
	if err != nil {
		return err
	}
	InvalidateSubscriptionPlanCache(planId)
	return nil
}

// Subscription plan
type SubscriptionPlan struct {
	Id int `json:"id"`

	Title    string `json:"title" gorm:"type:varchar(128);not null"`
	Subtitle string `json:"subtitle" gorm:"type:varchar(255);default:''"`

	// Display money amount (follow existing code style: float64 for money)
	PriceAmount float64  `json:"price_amount" gorm:"type:decimal(10,6);not null;default:0"`
	Currency    string   `json:"currency" gorm:"type:varchar(8);not null;default:'USD'"`
	PixPriceBRL *float64 `json:"pix_price_brl" gorm:"type:decimal(10,6)"`
	UpiPriceINR *float64 `json:"upi_price_inr" gorm:"type:decimal(10,6)"`

	DurationUnit  string `json:"duration_unit" gorm:"type:varchar(16);not null;default:'month'"`
	DurationValue int    `json:"duration_value" gorm:"type:int;not null;default:1"`
	CustomSeconds int64  `json:"custom_seconds" gorm:"type:bigint;not null;default:0"`

	Enabled   bool `json:"enabled" gorm:"default:true"`
	SortOrder int  `json:"sort_order" gorm:"type:int;default:0"`
	TierRank  *int `json:"tier_rank" gorm:"type:int;index"`

	AllowBalancePay *bool `json:"allow_balance_pay" gorm:"default:true"`

	StripePriceId         string `json:"stripe_price_id" gorm:"type:varchar(128);default:''"`
	CreemProductId        string `json:"creem_product_id" gorm:"type:varchar(128);default:''"`
	WaffoPancakeProductId string `json:"waffo_pancake_product_id" gorm:"type:varchar(128);default:''"`

	// Max purchases per user (0 = unlimited)
	MaxPurchasePerUser int `json:"max_purchase_per_user" gorm:"type:int;default:0"`

	// Upgrade user group after purchase (empty = no change)
	UpgradeGroup string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`

	// Total quota (amount in quota units, 0 = unlimited)
	TotalAmount int64 `json:"total_amount" gorm:"type:bigint;not null;default:0"`

	// Rolling 5-hour usage window limit in weighted quota units (0 = disabled).
	// 显式 column：GORM 默认会把 Window5hAmount 命名为 window5h_amount，与迁移列名不一致
	Window5hAmount int64 `json:"window_5h_amount" gorm:"column:window_5h_amount;type:bigint;not null;default:0"`
	// 7-day usage window limit in weighted quota units, cycle anchored at subscription start (0 = disabled)
	WindowWeekAmount int64 `json:"window_week_amount" gorm:"column:window_week_amount;type:bigint;not null;default:0"`

	// Media (image/video) credits granted per plan period, 1 credit = $0.01 (0 = plan has no media pool)
	MediaCreditsMonthly int64 `json:"media_credits_monthly" gorm:"type:bigint;not null;default:0"`

	// SeedKey marks system-seeded plans (e.g. "free") with a cross-database
	// unique key so concurrent nodes cannot create duplicate seed rows.
	// NULL for operator-created plans (unique indexes permit multiple NULLs
	// on SQLite/MySQL/PostgreSQL alike).
	SeedKey *string `json:"-" gorm:"column:seed_key;type:varchar(32);uniqueIndex:idx_subscription_plans_seed_key"`

	// Quota reset period for plan
	QuotaResetPeriod        string `json:"quota_reset_period" gorm:"type:varchar(16);default:'never'"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;default:0"`

	// ---- 面向用户的价值展示字段（纯展示，不参与计费）----
	// 套餐可用模型数量（0 = 不显示，前端回退为「全部模型」文案）
	ModelCount int `json:"model_count" gorm:"type:int;not null;default:0"`
	// Legacy display metadata kept for schema compatibility. Product plans no longer
	// advertise or configure a per-minute request limit; keep this value at 0.
	Rpm int `json:"rpm" gorm:"type:int;not null;default:0"`
	// 并发数上限（0 = 不显示）
	Concurrency int `json:"concurrency" gorm:"type:int;not null;default:0"`
	// 价值卖点，每行一条（admin 用换行分隔录入，前端按 \n 拆分渲染）
	// MySQL forbids DEFAULT on TEXT columns — keep the tag default-free; GORM
	// scans NULL into the zero value ("") for existing rows.
	FeatureLines string `json:"feature_lines" gorm:"type:text"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (p *SubscriptionPlan) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	p.CreatedAt = now
	p.UpdatedAt = now
	return nil
}

func (p *SubscriptionPlan) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

func (p *SubscriptionPlan) NormalizeDefaults() {
	if p.AllowBalancePay == nil {
		p.AllowBalancePay = common.GetPointer(true)
	}
}

func CreateSubscriptionPlan(plan *SubscriptionPlan) error {
	if plan == nil {
		return errors.New("subscription plan is nil")
	}
	plan.NormalizeDefaults()
	intendedEnabled := plan.Enabled
	if intendedEnabled {
		if err := validateSubscriptionPlanActiveRank(plan); err != nil {
			return err
		}
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Select("*").Create(plan).Error; err != nil {
			return err
		}
		if !intendedEnabled {
			plan.Enabled = false
			if err := tx.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Update("enabled", false).Error; err != nil {
				return err
			}
		}
		if intendedEnabled {
			if err := occupySubscriptionTierRankTx(tx, *plan.TierRank, plan.Id); err != nil {
				return err
			}
		}
		return nil
	})
	return invalidateSubscriptionPlanCacheOnSuccess(plan.Id, err)
}

func SetSubscriptionPlanEnabled(planId int, enabled bool) error {
	if planId <= 0 {
		return errors.New("invalid plan id")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var before SubscriptionPlan
		if err := tx.Where("id = ?", planId).First(&before).Error; err != nil {
			return err
		}
		after := before
		after.Enabled = enabled
		if err := updateSubscriptionPlanTx(tx, &before, &after); err != nil {
			return err
		}
		return nil
	})
	return invalidateSubscriptionPlanCacheOnSuccess(planId, err)
}

func UpdateSubscriptionPlan(plan *SubscriptionPlan) error {
	if plan == nil {
		return errors.New("subscription plan is nil")
	}
	if plan.Id <= 0 {
		return errors.New("invalid plan id")
	}
	plan.NormalizeDefaults()
	err := DB.Transaction(func(tx *gorm.DB) error {
		var before SubscriptionPlan
		if err := tx.Where("id = ?", plan.Id).First(&before).Error; err != nil {
			return err
		}
		before.NormalizeDefaults()
		if err := updateSubscriptionPlanTx(tx, &before, plan); err != nil {
			return err
		}
		return nil
	})
	return invalidateSubscriptionPlanCacheOnSuccess(plan.Id, err)
}

func updateSubscriptionPlanTx(tx *gorm.DB, before *SubscriptionPlan, plan *SubscriptionPlan) error {
	if plan.Enabled {
		if err := validateSubscriptionPlanActiveRank(plan); err != nil {
			return err
		}
	}
	if before.Enabled && !subscriptionPlanTierRanksEqual(before.TierRank, plan.TierRank) {
		if err := releaseSubscriptionTierRankTx(tx, before.TierRank, before.Id); err != nil {
			return err
		}
	}
	if before.Enabled && !plan.Enabled {
		if err := releaseSubscriptionTierRankTx(tx, before.TierRank, before.Id); err != nil {
			return err
		}
	}
	if lifecycleFieldsChanged(before, plan) {
		referenced, err := subscriptionPlanHasLifecycleReferenceTx(tx, plan.Id)
		if err != nil {
			return err
		}
		if referenced {
			return ErrSubscriptionPlanLifecycleFieldsImmutable
		}
	}
	if plan.Enabled && (!before.Enabled || !subscriptionPlanTierRanksEqual(before.TierRank, plan.TierRank)) {
		if err := occupySubscriptionTierRankTx(tx, *plan.TierRank, plan.Id); err != nil {
			return err
		}
	}
	updateMap := subscriptionPlanUpdateMap(plan)
	if err := tx.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(updateMap).Error; err != nil {
		return err
	}
	return nil
}

func validateSubscriptionPlanActiveRank(plan *SubscriptionPlan) error {
	if plan == nil || plan.TierRank == nil || *plan.TierRank <= 0 {
		return ErrSubscriptionTierRankRequired
	}
	return nil
}

func ReserveSubscriptionTierRank(tx *gorm.DB, tierRank int, planId int) error {
	return occupySubscriptionTierRankTx(tx, tierRank, planId)
}

func occupySubscriptionTierRankTx(tx *gorm.DB, tierRank int, planId int) error {
	if tierRank <= 0 {
		return ErrSubscriptionTierRankRequired
	}
	if planId <= 0 {
		return errors.New("invalid subscription tier rank reservation plan id")
	}
	if tx == nil {
		tx = DB
	}
	var existing SubscriptionTierRankReservation
	err := tx.Where("tier_rank = ?", tierRank).First(&existing).Error
	if err == nil {
		if existing.ActivePlanId == planId {
			return nil
		}
		return ErrSubscriptionTierRankReserved
	}
	if isSubscriptionRankContentionError(err) {
		return ErrSubscriptionTierRankReserved
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	var existingForPlan SubscriptionTierRankReservation
	err = tx.Where("active_plan_id = ?", planId).First(&existingForPlan).Error
	if err == nil {
		if existingForPlan.TierRank == tierRank {
			return nil
		}
		return ErrSubscriptionTierRankReserved
	}
	if isSubscriptionRankContentionError(err) {
		return ErrSubscriptionTierRankReserved
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	reservation := &SubscriptionTierRankReservation{
		TierRank:     tierRank,
		ActivePlanId: planId,
	}
	if err := tx.Create(reservation).Error; err != nil {
		if isSubscriptionTierRankDuplicateError(err) {
			return ErrSubscriptionTierRankReserved
		}
		if lookupErr := tx.Where("tier_rank = ?", tierRank).First(&existing).Error; lookupErr == nil {
			if existing.ActivePlanId == planId {
				return nil
			}
			return ErrSubscriptionTierRankReserved
		}
		if lookupErr := tx.Where("active_plan_id = ?", planId).First(&existingForPlan).Error; lookupErr == nil {
			if existingForPlan.TierRank == tierRank {
				return nil
			}
			return ErrSubscriptionTierRankReserved
		}
		if isSubscriptionRankContentionError(err) {
			return ErrSubscriptionTierRankReserved
		}
		return err
	}
	return nil
}

func isSubscriptionTierRankDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	var mysqlErr *mysqlDriver.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1062
	}
	var sqliteErr interface{ Code() int }
	if errors.As(err, &sqliteErr) {
		return sqliteErr.Code()&0xff == 19
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "constraint failed: unique")
}

func isSubscriptionRankContentionError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "database table is locked") ||
		strings.Contains(msg, "database is locked") ||
		strings.Contains(msg, "database is deadlocked")
}

func releaseSubscriptionTierRankTx(tx *gorm.DB, tierRank *int, planId int) error {
	if tierRank == nil || *tierRank <= 0 || planId <= 0 {
		return nil
	}
	if tx == nil {
		tx = DB
	}
	return tx.Where("tier_rank = ? AND active_plan_id = ?", *tierRank, planId).Delete(&SubscriptionTierRankReservation{}).Error
}

func subscriptionPlanTierRanksEqual(a *int, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func lifecycleFieldsChanged(before *SubscriptionPlan, after *SubscriptionPlan) bool {
	if before == nil || after == nil {
		return false
	}
	return !subscriptionPlanTierRanksEqual(before.TierRank, after.TierRank) ||
		before.DurationUnit != after.DurationUnit ||
		before.DurationValue != after.DurationValue ||
		before.CustomSeconds != after.CustomSeconds ||
		before.TotalAmount != after.TotalAmount ||
		before.StripePriceId != after.StripePriceId ||
		before.UpgradeGroup != after.UpgradeGroup
}

func subscriptionPlanHasLifecycleReferenceTx(tx *gorm.DB, planId int) (bool, error) {
	if tx == nil {
		tx = DB
	}
	checks := []struct {
		model interface{}
		where string
		args  []interface{}
	}{
		{model: &UserSubscriptionContract{}, where: "current_plan_id = ? OR pending_plan_id = ?", args: []interface{}{planId, planId}},
		{model: &UserSubscription{}, where: "plan_id = ?", args: []interface{}{planId}},
		{model: &SubscriptionOrder{}, where: "plan_id = ?", args: []interface{}{planId}},
		{model: &SubscriptionChangeIntent{}, where: "from_plan_id = ? OR to_plan_id = ?", args: []interface{}{planId, planId}},
	}
	for _, check := range checks {
		var count int64
		if err := tx.Model(check.model).Where(check.where, check.args...).Limit(1).Count(&count).Error; err != nil {
			return false, err
		}
		if count > 0 {
			return true, nil
		}
	}
	return false, nil
}

func subscriptionPlanUpdateMap(plan *SubscriptionPlan) map[string]interface{} {
	updateMap := map[string]interface{}{
		"title":                      plan.Title,
		"subtitle":                   plan.Subtitle,
		"price_amount":               plan.PriceAmount,
		"currency":                   plan.Currency,
		"pix_price_brl":              plan.PixPriceBRL,
		"upi_price_inr":              plan.UpiPriceINR,
		"duration_unit":              plan.DurationUnit,
		"duration_value":             plan.DurationValue,
		"custom_seconds":             plan.CustomSeconds,
		"enabled":                    plan.Enabled,
		"sort_order":                 plan.SortOrder,
		"tier_rank":                  plan.TierRank,
		"stripe_price_id":            plan.StripePriceId,
		"creem_product_id":           plan.CreemProductId,
		"waffo_pancake_product_id":   plan.WaffoPancakeProductId,
		"max_purchase_per_user":      plan.MaxPurchasePerUser,
		"total_amount":               plan.TotalAmount,
		"media_credits_monthly":      plan.MediaCreditsMonthly,
		"window_5h_amount":           plan.Window5hAmount,
		"window_week_amount":         plan.WindowWeekAmount,
		"upgrade_group":              plan.UpgradeGroup,
		"quota_reset_period":         plan.QuotaResetPeriod,
		"quota_reset_custom_seconds": plan.QuotaResetCustomSeconds,
		"model_count":                plan.ModelCount,
		"rpm":                        plan.Rpm,
		"concurrency":                plan.Concurrency,
		"feature_lines":              plan.FeatureLines,
		"updated_at":                 common.GetTimestamp(),
	}
	if plan.AllowBalancePay != nil {
		updateMap["allow_balance_pay"] = *plan.AllowBalancePay
	}
	return updateMap
}

// Subscription order (payment -> webhook -> create UserSubscription)
type SubscriptionOrder struct {
	Id     int `json:"id"`
	UserId int `json:"user_id" gorm:"index"`
	PlanId int `json:"plan_id" gorm:"index"`
	// Money is the amount actually charged (plan price minus any applied
	// first-subscription invitee discount).
	Money float64 `json:"money"`
	// DiscountUSD records the invitee first-subscription discount applied to
	// this order (0 = none), so support/reconciliation can see why Money is
	// below the plan price.
	DiscountUSD float64 `json:"discount_usd" gorm:"default:0"`

	TradeNo         string `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	Status          string `json:"status"`
	CreateTime      int64  `json:"create_time"`
	CompleteTime    int64  `json:"complete_time"`

	PurchaseMonths     int     `json:"purchase_months" gorm:"type:int;not null;default:0"`
	UnitPrice          float64 `json:"unit_price" gorm:"type:decimal(10,6);not null;default:0"`
	PaymentCurrency    string  `json:"payment_currency" gorm:"type:varchar(8);not null;default:'USD';index"`
	PaymentAmountMinor int64   `json:"payment_amount_minor" gorm:"type:bigint;not null;default:0"`
	PlanSnapshot       string  `json:"plan_snapshot" gorm:"type:text"`
	PurchaseIntent     string  `json:"purchase_intent" gorm:"type:varchar(32);default:'';index"`
	RenewalSource      string  `json:"renewal_source" gorm:"type:varchar(32);default:'';index"`

	ProviderPayload    string `json:"provider_payload" gorm:"type:text"`
	ChangeIntentId     int64  `json:"change_intent_id" gorm:"type:bigint;default:0;index"`
	ProviderSessionId  string `json:"provider_session_id" gorm:"type:varchar(128);default:'';index"`
	ProviderSessionURL string `json:"provider_session_url" gorm:"type:text"`
}

func (o *SubscriptionOrder) Insert() error {
	if o.CreateTime == 0 {
		o.CreateTime = common.GetTimestamp()
	}
	return DB.Create(o).Error
}

func (o *SubscriptionOrder) Update() error {
	return DB.Save(o).Error
}

func GetSubscriptionOrderByTradeNo(tradeNo string) *SubscriptionOrder {
	if tradeNo == "" {
		return nil
	}
	var order SubscriptionOrder
	if err := DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

func StripeCheckoutSessionIDFromProviderPayload(providerPayload string) string {
	var payload struct {
		CheckoutSessionId string `json:"checkout_session_id"`
	}
	if err := common.Unmarshal([]byte(providerPayload), &payload); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.CheckoutSessionId)
}

// User subscription instance
type UserSubscription struct {
	Id                int     `json:"id"`
	UserId            int     `json:"user_id" gorm:"index;index:idx_user_sub_active,priority:1"`
	PlanId            int     `json:"plan_id" gorm:"index"`
	ContractId        int64   `json:"contract_id" gorm:"type:bigint;default:0;uniqueIndex:idx_contract_current_slot,priority:1"`
	ProviderBindingId int64   `json:"provider_binding_id" gorm:"type:bigint;default:0;index"`
	GrantKey          *string `json:"grant_key" gorm:"type:varchar(255);uniqueIndex"`
	CurrentSlot       *int    `json:"current_slot" gorm:"uniqueIndex:idx_contract_current_slot,priority:2"`

	AmountTotal int64 `json:"amount_total" gorm:"type:bigint;not null;default:0"`
	AmountUsed  int64 `json:"amount_used" gorm:"type:bigint;not null;default:0"`

	// Media (image/video) credits pool, snapshot from plan at purchase; resets with the quota cycle
	MediaCreditsTotal int64 `json:"media_credits_total" gorm:"type:bigint;not null;default:0"`
	MediaCreditsUsed  int64 `json:"media_credits_used" gorm:"type:bigint;not null;default:0"`

	// Nil means a legacy entitlement created before window limits were snapshotted.
	Window5hAmount   *int64 `json:"window_5h_amount,omitempty" gorm:"column:window_5h_amount;type:bigint"`
	WindowWeekAmount *int64 `json:"window_week_amount,omitempty" gorm:"column:window_week_amount;type:bigint"`

	StartTime     int64  `json:"start_time" gorm:"bigint"`
	EndTime       int64  `json:"end_time" gorm:"bigint;index;index:idx_user_sub_active,priority:3"`
	AccessEndTime int64  `json:"access_end_time" gorm:"type:bigint;default:0;index"`
	EndReason     string `json:"end_reason" gorm:"type:varchar(64);default:''"`
	Status        string `json:"status" gorm:"type:varchar(32);index;index:idx_user_sub_active,priority:2"` // active/expired/cancelled

	Source      string `json:"source" gorm:"type:varchar(32);default:'order'"` // order/admin/balance/stripe/subscription
	PaymentMode string `json:"payment_mode" gorm:"type:varchar(32);default:''"`

	LastResetTime int64 `json:"last_reset_time" gorm:"type:bigint;default:0"`
	NextResetTime int64 `json:"next_reset_time" gorm:"type:bigint;default:0;index"`

	UpgradeGroup  string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`
	PrevUserGroup string `json:"prev_user_group" gorm:"type:varchar(64);default:''"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (s *UserSubscription) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	s.CreatedAt = now
	s.UpdatedAt = now
	s.normalizeLifecycleFields()
	return nil
}

func (s *UserSubscription) BeforeUpdate(tx *gorm.DB) error {
	s.UpdatedAt = common.GetTimestamp()
	s.normalizeLifecycleFields()
	return nil
}

func (s *UserSubscription) normalizeLifecycleFields() {
	if s.GrantKey != nil {
		grantKey := strings.TrimSpace(*s.GrantKey)
		if grantKey == "" {
			s.GrantKey = nil
		} else {
			s.GrantKey = &grantKey
		}
	}
	s.EndReason = strings.TrimSpace(s.EndReason)
	s.PaymentMode = normalizeSubscriptionPaymentMode(s.PaymentMode)
}

type SubscriptionSummary struct {
	Subscription    *UserSubscription                   `json:"subscription"`
	ProviderBinding *SubscriptionProviderBindingSummary `json:"provider_binding,omitempty"`
}

type SubscriptionProviderBindingSummary struct {
	BindingId         int64  `json:"binding_id"`
	Provider          string `json:"provider"`
	ProviderStatus    string `json:"provider_status"`
	CancelAtPeriodEnd bool   `json:"cancel_at_period_end"`
	CurrentPeriodEnd  int64  `json:"current_period_end"`
}

func calcPlanEndTime(start time.Time, plan *SubscriptionPlan) (int64, error) {
	if plan == nil {
		return 0, errors.New("plan is nil")
	}
	if plan.DurationValue <= 0 && plan.DurationUnit != SubscriptionDurationCustom {
		return 0, errors.New("duration_value must be > 0")
	}
	switch plan.DurationUnit {
	case SubscriptionDurationYear:
		return start.AddDate(plan.DurationValue, 0, 0).Unix(), nil
	case SubscriptionDurationMonth:
		return start.AddDate(0, plan.DurationValue, 0).Unix(), nil
	case SubscriptionDurationDay:
		return start.Add(time.Duration(plan.DurationValue) * 24 * time.Hour).Unix(), nil
	case SubscriptionDurationHour:
		return start.Add(time.Duration(plan.DurationValue) * time.Hour).Unix(), nil
	case SubscriptionDurationCustom:
		if plan.CustomSeconds <= 0 {
			return 0, errors.New("custom_seconds must be > 0")
		}
		return start.Add(time.Duration(plan.CustomSeconds) * time.Second).Unix(), nil
	default:
		return 0, fmt.Errorf("invalid duration_unit: %s", plan.DurationUnit)
	}
}

func NormalizeResetPeriod(period string) string {
	switch strings.TrimSpace(period) {
	case SubscriptionResetDaily, SubscriptionResetWeekly, SubscriptionResetMonthly, SubscriptionResetCustom:
		return strings.TrimSpace(period)
	default:
		return SubscriptionResetNever
	}
}

func calcNextResetTime(base time.Time, plan *SubscriptionPlan, endUnix int64) int64 {
	if plan == nil {
		return 0
	}
	period := NormalizeResetPeriod(plan.QuotaResetPeriod)
	if period == SubscriptionResetNever {
		return 0
	}
	var next time.Time
	switch period {
	case SubscriptionResetDaily:
		next = time.Date(base.Year(), base.Month(), base.Day(), 0, 0, 0, 0, base.Location()).
			AddDate(0, 0, 1)
	case SubscriptionResetWeekly:
		// Align to next Monday 00:00
		weekday := int(base.Weekday()) // Sunday=0
		// Convert to Monday=1..Sunday=7
		if weekday == 0 {
			weekday = 7
		}
		daysUntil := 8 - weekday
		next = time.Date(base.Year(), base.Month(), base.Day(), 0, 0, 0, 0, base.Location()).
			AddDate(0, 0, daysUntil)
	case SubscriptionResetMonthly:
		// Align to first day of next month 00:00
		next = time.Date(base.Year(), base.Month(), 1, 0, 0, 0, 0, base.Location()).
			AddDate(0, 1, 0)
	case SubscriptionResetCustom:
		if plan.QuotaResetCustomSeconds <= 0 {
			return 0
		}
		next = base.Add(time.Duration(plan.QuotaResetCustomSeconds) * time.Second)
	default:
		return 0
	}
	if endUnix > 0 && next.Unix() > endUnix {
		return 0
	}
	return next.Unix()
}

func GetSubscriptionPlanById(id int) (*SubscriptionPlan, error) {
	return getSubscriptionPlanByIdTx(nil, id)
}

func ListRecallStripeSubscriptionPrices() ([]string, error) {
	return ListRecallStripeSubscriptionPricesWithContext(context.Background())
}

func ListRecallStripeSubscriptionPricesWithContext(ctx context.Context) ([]string, error) {
	var configured []string
	if err := DB.WithContext(ctx).
		Model(&SubscriptionPlan{}).
		Where("enabled = ?", true).
		Order("id ASC").
		Pluck("stripe_price_id", &configured).Error; err != nil {
		return nil, err
	}

	prices := make([]string, 0, len(configured))
	seen := make(map[string]struct{}, len(configured))
	for _, configuredPrice := range configured {
		priceID := strings.TrimSpace(configuredPrice)
		if priceID == "" {
			continue
		}
		if _, exists := seen[priceID]; exists {
			continue
		}
		seen[priceID] = struct{}{}
		prices = append(prices, priceID)
	}
	return prices, nil
}

func ListRecallSubscriptionPlansByStripePriceIDsWithContext(ctx context.Context, rawPriceIDs []string) ([]SubscriptionPlan, error) {
	priceIDs := make([]string, 0, len(rawPriceIDs))
	seen := make(map[string]struct{}, len(rawPriceIDs))
	for _, rawPriceID := range rawPriceIDs {
		priceID := strings.TrimSpace(rawPriceID)
		if priceID == "" {
			continue
		}
		if _, exists := seen[priceID]; exists {
			continue
		}
		seen[priceID] = struct{}{}
		priceIDs = append(priceIDs, priceID)
	}
	if len(priceIDs) == 0 {
		return []SubscriptionPlan{}, nil
	}

	var plans []SubscriptionPlan
	if err := DB.WithContext(ctx).
		Select("title", "price_amount", "currency", "stripe_price_id").
		Where("stripe_price_id IN ?", priceIDs).
		Find(&plans).Error; err != nil {
		return nil, err
	}
	return plans, nil
}

func getSubscriptionPlanByIdTx(tx *gorm.DB, id int) (*SubscriptionPlan, error) {
	if id <= 0 {
		return nil, errors.New("invalid plan id")
	}
	key := subscriptionPlanCacheKey(id)
	if key != "" {
		if cached, found, err := getSubscriptionPlanCache().Get(key); err == nil && found {
			cached.NormalizeDefaults()
			return &cached, nil
		}
	}
	var plan SubscriptionPlan
	query := DB
	if tx != nil {
		query = tx
	}
	if err := query.Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, err
	}
	plan.NormalizeDefaults()
	_ = getSubscriptionPlanCache().SetWithTTL(key, plan, subscriptionPlanCacheTTL())
	return &plan, nil
}

func CountUserSubscriptionsByPlan(userId int, planId int) (int64, error) {
	if userId <= 0 || planId <= 0 {
		return 0, errors.New("invalid userId or planId")
	}
	var count int64
	if err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", userId, planId).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func getUserGroupByIdTx(tx *gorm.DB, userId int) (string, error) {
	if userId <= 0 {
		return "", errors.New("invalid userId")
	}
	if tx == nil {
		tx = DB
	}
	groupCol := commonGroupCol
	if strings.TrimSpace(groupCol) == "" {
		groupCol = "`group`"
		if common.UsingPostgreSQL {
			groupCol = `"group"`
		}
	}
	var group string
	if err := tx.Model(&User{}).Where("id = ?", userId).Select(groupCol).Find(&group).Error; err != nil {
		return "", err
	}
	return group, nil
}

func downgradeUserGroupForSubscriptionTx(tx *gorm.DB, sub *UserSubscription, now int64) (string, error) {
	if tx == nil || sub == nil {
		return "", errors.New("invalid downgrade args")
	}
	upgradeGroup := strings.TrimSpace(sub.UpgradeGroup)
	if upgradeGroup == "" {
		return "", nil
	}
	currentGroup, err := getUserGroupByIdTx(tx, sub.UserId)
	if err != nil {
		return "", err
	}
	if currentGroup != upgradeGroup {
		return "", nil
	}
	var activeSub UserSubscription
	activeQuery := tx.Where("user_id = ? AND status = ? AND end_time > ? AND id <> ? AND upgrade_group <> ''",
		sub.UserId, "active", now, sub.Id).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&activeSub)
	if activeQuery.Error == nil && activeQuery.RowsAffected > 0 {
		return "", nil
	}
	prevGroup := strings.TrimSpace(sub.PrevUserGroup)
	if prevGroup == "" || prevGroup == currentGroup {
		return "", nil
	}
	if err := tx.Model(&User{}).Where("id = ?", sub.UserId).
		Update("group", prevGroup).Error; err != nil {
		return "", err
	}
	return prevGroup, nil
}

func CreateUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string) (*UserSubscription, error) {
	return createUserSubscriptionFromPlanTx(tx, userId, plan, source, 0)
}

func createUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string, providerBindingId int64) (*UserSubscription, error) {
	if tx == nil {
		return nil, errors.New("tx is nil")
	}
	if plan == nil || plan.Id == 0 {
		return nil, errors.New("invalid plan")
	}
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	if plan.MaxPurchasePerUser > 0 {
		var count int64
		if err := tx.Model(&UserSubscription{}).
			Where("user_id = ? AND plan_id = ?", userId, plan.Id).
			Count(&count).Error; err != nil {
			return nil, err
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			return nil, errors.New("已达到该套餐购买上限")
		}
	}
	nowUnix := GetDBTimestamp()
	now := time.Unix(nowUnix, 0)
	endUnix, err := calcPlanEndTime(now, plan)
	if err != nil {
		return nil, err
	}
	resetBase := now
	nextReset := calcNextResetTime(resetBase, plan, endUnix)
	lastReset := int64(0)
	if nextReset > 0 {
		lastReset = now.Unix()
	}
	upgradeGroup := strings.TrimSpace(plan.UpgradeGroup)
	prevGroup := ""
	if upgradeGroup != "" {
		currentGroup, err := getUserGroupByIdTx(tx, userId)
		if err != nil {
			return nil, err
		}
		if currentGroup != upgradeGroup {
			prevGroup = currentGroup
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("group", upgradeGroup).Error; err != nil {
				return nil, err
			}
		}
	}
	window5hAmount := plan.Window5hAmount
	windowWeekAmount := plan.WindowWeekAmount
	sub := &UserSubscription{
		UserId:            userId,
		PlanId:            plan.Id,
		ProviderBindingId: providerBindingId,
		AmountTotal:       plan.TotalAmount,
		AmountUsed:        0,
		MediaCreditsTotal: plan.MediaCreditsMonthly,
		MediaCreditsUsed:  0,
		Window5hAmount:    &window5hAmount,
		WindowWeekAmount:  &windowWeekAmount,
		StartTime:         now.Unix(),
		EndTime:           endUnix,
		Status:            "active",
		Source:            source,
		LastResetTime:     lastReset,
		NextResetTime:     nextReset,
		UpgradeGroup:      upgradeGroup,
		PrevUserGroup:     prevGroup,
		CreatedAt:         common.GetTimestamp(),
		UpdatedAt:         common.GetTimestamp(),
	}
	if err := tx.Create(sub).Error; err != nil {
		return nil, err
	}
	return sub, nil
}

// Complete a subscription order (idempotent). Creates a UserSubscription snapshot from the plan.
// expectedPaymentProvider guards against cross-gateway callback attacks (empty skips the check).
// actualPaymentMethod updates the order's PaymentMethod to reflect the real payment type used (empty skips update).
func CompleteSubscriptionOrder(tradeNo string, providerPayload string, expectedPaymentProvider string, actualPaymentMethod string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	var logUserId int
	var logPlanTitle string
	var logMoney float64
	var logPaymentMethod string
	var upgradeGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrSubscriptionOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if order.Status != common.TopUpStatusPending {
			return ErrSubscriptionOrderStatusInvalid
		}
		plan, err := GetSubscriptionPlanById(order.PlanId)
		if err != nil {
			return err
		}
		if !plan.Enabled {
			// still allow completion for already purchased orders
		}
		upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		_, err = CreateUserSubscriptionFromPlanTx(tx, order.UserId, plan, "order")
		if err != nil {
			return err
		}
		if err := upsertSubscriptionTopUpTx(tx, &order); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		if providerPayload != "" {
			order.ProviderPayload = providerPayload
		}
		if actualPaymentMethod != "" && order.PaymentMethod != actualPaymentMethod {
			order.PaymentMethod = actualPaymentMethod
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		logUserId = order.UserId
		logPlanTitle = plan.Title
		logMoney = order.Money
		logPaymentMethod = order.PaymentMethod
		return nil
	})
	if err != nil {
		return err
	}
	if upgradeGroup != "" && logUserId > 0 {
		_ = UpdateUserGroupCache(logUserId, upgradeGroup)
	}
	if logUserId > 0 {
		msg := fmt.Sprintf("订阅购买成功，套餐: %s，支付金额: %.2f，支付方式: %s", logPlanTitle, logMoney, logPaymentMethod)
		RecordLog(logUserId, LogTypeTopup, msg)
	}
	if err := TryGrantInviteSubscriptionRewardAfterOrderCompleted(tradeNo); err != nil {
		// Reward bookkeeping must never fail an already-completed payment.
		common.SysError(fmt.Sprintf("invite subscription reward grant failed for order %s: %v", tradeNo, err))
	}
	return nil
}

func upsertSubscriptionTopUpTx(tx *gorm.DB, order *SubscriptionOrder) error {
	if tx == nil || order == nil {
		return errors.New("invalid subscription order")
	}
	now := common.GetTimestamp()
	var topup TopUp
	if err := tx.Where("trade_no = ?", order.TradeNo).First(&topup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			topup = TopUp{
				UserId:          order.UserId,
				Amount:          0,
				Money:           order.Money,
				TradeNo:         order.TradeNo,
				PaymentMethod:   order.PaymentMethod,
				PaymentProvider: order.PaymentProvider,
				// Plan prices are USD-denominated regardless of gateway.
				PaymentCurrency: "USD",
				CreateTime:      order.CreateTime,
				CompleteTime:    now,
				Status:          common.TopUpStatusSuccess,
			}
			return tx.Create(&topup).Error
		}
		return err
	}
	topup.Money = order.Money
	if topup.PaymentMethod == "" {
		topup.PaymentMethod = order.PaymentMethod
	} else if topup.PaymentMethod != order.PaymentMethod {
		return ErrPaymentMethodMismatch
	}
	if topup.PaymentProvider == "" {
		topup.PaymentProvider = order.PaymentProvider
	} else if topup.PaymentProvider != order.PaymentProvider {
		return ErrPaymentMethodMismatch
	}
	if topup.CreateTime == 0 {
		topup.CreateTime = order.CreateTime
	}
	topup.CompleteTime = now
	topup.Status = common.TopUpStatusSuccess
	return tx.Save(&topup).Error
}

// SyncSubscriptionOrderTopUpHistory mirrors the current SubscriptionOrder payment
// state into TopUp history so existing billing-history and resume flows can use it.
func SyncSubscriptionOrderTopUpHistory(tradeNo string) error {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrSubscriptionOrderNotFound
			}
			return err
		}
		return syncSubscriptionOrderTopUpHistoryTx(tx, &order)
	})
}

func syncSubscriptionOrderTopUpHistoryTx(tx *gorm.DB, order *SubscriptionOrder) error {
	if tx == nil || order == nil {
		return errors.New("invalid subscription order")
	}
	status := strings.TrimSpace(order.Status)
	switch status {
	case common.TopUpStatusPending:
		if strings.TrimSpace(order.ProviderSessionId) == "" {
			return errors.New("pending subscription order checkout session is missing")
		}
	case common.TopUpStatusSuccess, common.TopUpStatusFailed, common.TopUpStatusExpired:
	default:
		return ErrSubscriptionOrderStatusInvalid
	}

	var topup TopUp
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("trade_no = ?", order.TradeNo).First(&topup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(subscriptionOrderTopUpHistory(order, status)).Error
		}
		return err
	}
	if topup.UserId != order.UserId ||
		(strings.TrimSpace(topup.PaymentMethod) != "" && topup.PaymentMethod != order.PaymentMethod) ||
		(strings.TrimSpace(topup.PaymentProvider) != "" && topup.PaymentProvider != order.PaymentProvider) {
		return ErrPaymentMethodMismatch
	}
	if topup.Status == common.TopUpStatusSuccess && status != common.TopUpStatusSuccess {
		return nil
	}
	topup.UserId = order.UserId
	topup.Money = order.Money
	topup.PaymentMethod = order.PaymentMethod
	topup.PaymentProvider = order.PaymentProvider
	topup.PaymentCurrency = strings.ToUpper(strings.TrimSpace(order.PaymentCurrency))
	topup.PaymentAmountMinor = order.PaymentAmountMinor
	if strings.TrimSpace(order.ProviderSessionId) != "" {
		topup.GatewayTradeNo = strings.TrimSpace(order.ProviderSessionId)
	}
	if topup.CreateTime == 0 {
		topup.CreateTime = order.CreateTime
	}
	topup.Status = status
	topup.CompleteTime = subscriptionOrderTopUpCompleteTime(order, status)
	return tx.Save(&topup).Error
}

func subscriptionOrderTopUpHistory(order *SubscriptionOrder, status string) *TopUp {
	return &TopUp{
		UserId:             order.UserId,
		Amount:             0,
		Money:              order.Money,
		TradeNo:            strings.TrimSpace(order.TradeNo),
		GatewayTradeNo:     strings.TrimSpace(order.ProviderSessionId),
		PaymentMethod:      order.PaymentMethod,
		PaymentProvider:    order.PaymentProvider,
		PaymentCurrency:    strings.ToUpper(strings.TrimSpace(order.PaymentCurrency)),
		PaymentAmountMinor: order.PaymentAmountMinor,
		CreateTime:         order.CreateTime,
		CompleteTime:       subscriptionOrderTopUpCompleteTime(order, status),
		Status:             status,
	}
}

func subscriptionOrderTopUpCompleteTime(order *SubscriptionOrder, status string) int64 {
	if status == common.TopUpStatusPending {
		return 0
	}
	if order.CompleteTime > 0 {
		return order.CompleteTime
	}
	return common.GetTimestamp()
}

func ExpireSubscriptionOrder(tradeNo string, expectedPaymentProvider string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrSubscriptionOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status != common.TopUpStatusPending {
			return nil
		}
		order.Status = common.TopUpStatusExpired
		order.CompleteTime = common.GetTimestamp()
		return tx.Save(&order).Error
	})
}

// Admin bind (no payment). Creates a UserSubscription from a plan.
func AdminBindSubscription(userId int, planId int, sourceNote string) (string, error) {
	if userId <= 0 || planId <= 0 {
		return "", errors.New("invalid userId or planId")
	}
	plan, err := GetSubscriptionPlanById(planId)
	if err != nil {
		return "", err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		_, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "admin")
		return err
	})
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(plan.UpgradeGroup) != "" {
		_ = UpdateUserGroupCache(userId, plan.UpgradeGroup)
		return fmt.Sprintf("用户分组将升级到 %s", plan.UpgradeGroup), nil
	}
	return "", nil
}

func calcSubscriptionBalanceQuota(priceAmount float64) (int, error) {
	if priceAmount <= 0 {
		return 0, nil
	}
	if common.QuotaPerUnit <= 0 {
		return 0, errors.New("额度单位配置错误")
	}
	quota := decimal.NewFromFloat(priceAmount).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Ceil().
		IntPart()
	return int(quota), nil
}

// PurchaseSubscriptionWithBalance creates a subscription by deducting the user's wallet quota.
func PurchaseSubscriptionWithBalance(userId int, planId int) error {
	if userId <= 0 || planId <= 0 {
		return errors.New("invalid userId or planId")
	}

	var logPlanTitle string
	var logMoney float64
	var chargedQuota int
	var upgradeGroup string
	var completedTradeNo string
	err := DB.Transaction(func(tx *gorm.DB) error {
		plan, err := getSubscriptionPlanByIdTx(tx, planId)
		if err != nil {
			return err
		}
		if !plan.Enabled {
			return errors.New("套餐未启用")
		}
		if plan.PriceAmount < 0 {
			return errors.New("套餐价格不能为负数")
		}
		if plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
			return errors.New("该套餐不允许使用余额兑换")
		}

		// 被邀用户首次订阅：首月立减（与 Stripe 路径同口径）。claim 会锁用户行
		// 并把已占用折扣的 pending/success 订单计入名额，并发购买只折一次。
		discountUSD, err := claimInviteFirstSubDiscountTx(tx, userId, plan.PriceAmount, 0)
		if err != nil {
			common.SysLog("查询被邀首订折扣失败，按无折扣处理: " + err.Error())
			discountUSD = 0
		}
		chargedPrice := plan.PriceAmount - discountUSD

		requiredQuota, err := calcSubscriptionBalanceQuota(chargedPrice)
		if err != nil {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if requiredQuota > 0 && user.Quota < requiredQuota {
			return errors.New("余额不足")
		}
		if requiredQuota > 0 {
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota - ?", requiredQuota)).Error; err != nil {
				return err
			}
		}

		if _, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, PaymentMethodBalance); err != nil {
			return err
		}

		now := common.GetTimestamp()
		tradeNo := fmt.Sprintf("SUBBALUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().UnixNano())
		order := &SubscriptionOrder{
			UserId:          userId,
			PlanId:          plan.Id,
			Money:           chargedPrice,
			DiscountUSD:     discountUSD,
			TradeNo:         tradeNo,
			PaymentMethod:   PaymentMethodBalance,
			PaymentProvider: PaymentProviderBalance,
			Status:          common.TopUpStatusSuccess,
			CreateTime:      now,
			CompleteTime:    now,
			ProviderPayload: fmt.Sprintf("charged_quota=%d", requiredQuota),
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		// 让余额购买的订阅也进入计费历史（与网关支付订阅一致，见 CompleteSubscriptionOrder）。
		// 记录为一笔 method=balance 的成功付款，Money=套餐价，Amount=0（不加钱包余额）。
		if err := upsertSubscriptionTopUpTx(tx, order); err != nil {
			return err
		}

		logPlanTitle = plan.Title
		logMoney = chargedPrice
		chargedQuota = requiredQuota
		upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		completedTradeNo = tradeNo
		return nil
	})
	if err != nil {
		return err
	}

	if chargedQuota > 0 {
		if err := cacheDecrUserQuota(userId, int64(chargedQuota)); err != nil {
			common.SysLog("failed to decrease user quota cache after subscription balance purchase: " + err.Error())
		}
	}
	if upgradeGroup != "" {
		_ = UpdateUserGroupCache(userId, upgradeGroup)
	}
	msg := fmt.Sprintf("使用余额购买订阅成功，套餐: %s，支付金额: %.2f，扣除额度: %d", logPlanTitle, logMoney, chargedQuota)
	RecordLog(userId, LogTypeTopup, msg)
	// Balance purchases bypass CompleteSubscriptionOrder, so trigger the same
	// idempotent referral-reward bookkeeping here (never fails the purchase).
	if err := TryGrantInviteSubscriptionRewardAfterOrderCompleted(completedTradeNo); err != nil {
		common.SysError(fmt.Sprintf("invite subscription reward grant failed for balance order %s: %v", completedTradeNo, err))
	}
	return nil
}

// GetAllActiveUserSubscriptions returns all active subscriptions for a user.
func GetAllActiveUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	var subs []UserSubscription
	err := DB.Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return buildSubscriptionSummaries(subs), nil
}

// SubscriptionWindowInfo carries the data needed to enforce usage windows
// (5h rolling + weekly anchored at subscription start) before pre-consume.
type SubscriptionWindowInfo struct {
	UserSubscriptionId int
	ContractId         int64
	SubscriptionStart  int64
	Window5hAmount     int64
	WindowWeekAmount   int64
}

func (i *SubscriptionWindowInfo) WindowIdentity() int {
	if i == nil {
		return 0
	}
	if i.ContractId > 0 {
		return int(i.ContractId)
	}
	return i.UserSubscriptionId
}

// GetActiveSubscriptionWindowInfo returns window limits for the user's first
// active subscription (same end_time asc order as PreConsumeUserSubscription).
// Returns (nil, nil) when the user has no active subscription.
func GetActiveSubscriptionWindowInfo(userId int) (*SubscriptionWindowInfo, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	var sub UserSubscription
	query := DB.Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Order("end_time asc, id asc").Limit(1).Find(&sub)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return subscriptionWindowInfoForSub(&sub)
}

// GetChargeableSubscriptionWindowInfo predicts which active subscription
// PreConsumeUserSubscription would charge for the given weighted amount —
// same end_time asc order, skipping plans whose remaining pool can't cover
// it — and returns that subscription's window limits. Read-only prediction:
// a concurrent request can still change the outcome, so callers must
// re-validate against the actually charged subscription id afterwards.
// Returns (nil, nil) when the user has no active subscription.
func GetChargeableSubscriptionWindowInfo(userId int, amount int64) (*SubscriptionWindowInfo, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	current, hasContract, _, err := findContractCurrentEntitlementForUserTx(DB, userId, now, false)
	if err != nil {
		return nil, err
	}
	if hasContract {
		if current == nil {
			return nil, nil
		}
		return subscriptionWindowInfoForSub(current)
	}
	var subs []UserSubscription
	if err := DB.Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Order("end_time asc, id asc").
		Find(&subs).Error; err != nil {
		return nil, err
	}
	if len(subs) == 0 {
		return nil, nil
	}
	var fallback *UserSubscription
	for i := range subs {
		sub := &subs[i]
		if fallback == nil {
			fallback = sub
		}
		if sub.AmountTotal > 0 && sub.AmountTotal-sub.AmountUsed < amount {
			continue
		}
		return subscriptionWindowInfoForSub(sub)
	}
	// Every pool is short — PreConsume will fail, but keep the first sub's
	// windows enforced for consistency with the historical behavior.
	return subscriptionWindowInfoForSub(fallback)
}

// GetSubscriptionWindowInfoBySubId returns window limits for one specific
// user subscription (used to re-reserve after a prediction mismatch).
func GetSubscriptionWindowInfoBySubId(subId int) (*SubscriptionWindowInfo, error) {
	if subId <= 0 {
		return nil, errors.New("invalid subscription id")
	}
	var sub UserSubscription
	query := DB.Where("id = ?", subId).Limit(1).Find(&sub)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return subscriptionWindowInfoForSub(&sub)
}

func subscriptionWindowInfoForSub(sub *UserSubscription) (*SubscriptionWindowInfo, error) {
	if sub == nil {
		return nil, nil
	}
	var window5hAmount int64
	var windowWeekAmount int64
	if sub.Window5hAmount != nil {
		window5hAmount = *sub.Window5hAmount
	}
	if sub.WindowWeekAmount != nil {
		windowWeekAmount = *sub.WindowWeekAmount
	}
	if sub.Window5hAmount == nil || sub.WindowWeekAmount == nil {
		plan, err := GetSubscriptionPlanById(sub.PlanId)
		if err != nil {
			return nil, err
		}
		if sub.Window5hAmount == nil {
			window5hAmount = plan.Window5hAmount
		}
		if sub.WindowWeekAmount == nil {
			windowWeekAmount = plan.WindowWeekAmount
		}
	}
	anchor := sub.StartTime
	if sub.ContractId > 0 {
		var contract UserSubscriptionContract
		query := DB.Where("id = ? AND user_id = ?", sub.ContractId, sub.UserId).Limit(1).Find(&contract)
		if query.Error != nil {
			return nil, query.Error
		}
		if query.RowsAffected > 0 && contract.CreatedAt > 0 {
			anchor = contract.CreatedAt
		}
	}
	return &SubscriptionWindowInfo{
		UserSubscriptionId: sub.Id,
		ContractId:         sub.ContractId,
		SubscriptionStart:  anchor,
		Window5hAmount:     window5hAmount,
		WindowWeekAmount:   windowWeekAmount,
	}, nil
}

// HasActiveUserSubscription returns whether the user has any active subscription.
// This is a lightweight existence check to avoid heavy pre-consume transactions.
func HasActiveUserSubscription(userId int) (bool, error) {
	if userId <= 0 {
		return false, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	return hasActiveUserSubscriptionTx(DB, userId, now)
}

// GetAllUserSubscriptions returns all subscriptions (active and expired) for a user.
func GetAllUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	var subs []UserSubscription
	err := DB.Where("user_id = ?", userId).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return buildSubscriptionSummaries(subs), nil
}

func buildSubscriptionSummaries(subs []UserSubscription) []SubscriptionSummary {
	if len(subs) == 0 {
		return []SubscriptionSummary{}
	}
	bindingIDs := make([]int64, 0, len(subs))
	for _, sub := range subs {
		if sub.ProviderBindingId > 0 {
			bindingIDs = append(bindingIDs, sub.ProviderBindingId)
		}
	}
	bindingMap := map[int64]SubscriptionProviderBinding{}
	if len(bindingIDs) > 0 {
		var bindings []SubscriptionProviderBinding
		if err := DB.Where("id IN ?", bindingIDs).Find(&bindings).Error; err == nil {
			for _, binding := range bindings {
				bindingMap[binding.Id] = binding
			}
		}
	}
	result := make([]SubscriptionSummary, 0, len(subs))
	for _, sub := range subs {
		subCopy := sub
		summary := SubscriptionSummary{
			Subscription: &subCopy,
		}
		if binding, ok := bindingMap[sub.ProviderBindingId]; ok {
			summary.ProviderBinding = &SubscriptionProviderBindingSummary{
				BindingId:         binding.Id,
				Provider:          binding.Provider,
				ProviderStatus:    binding.ProviderStatus,
				CancelAtPeriodEnd: binding.CancelAtPeriodEnd,
				CurrentPeriodEnd:  binding.CurrentPeriodEnd,
			}
		}
		result = append(result, summary)
	}
	return result
}

// AdminInvalidateUserSubscription marks a user subscription as cancelled and ends it immediately.
func AdminInvalidateUserSubscription(userSubscriptionId int) (string, error) {
	if userSubscriptionId <= 0 {
		return "", errors.New("invalid userSubscriptionId")
	}
	now := common.GetTimestamp()
	cacheGroup := ""
	downgradeGroup := ""
	var userId int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		userId = sub.UserId
		if err := tx.Model(&sub).Updates(map[string]interface{}{
			"status":     "cancelled",
			"end_time":   now,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		target, err := downgradeUserGroupForSubscriptionTx(tx, &sub, now)
		if err != nil {
			return err
		}
		if target != "" {
			cacheGroup = target
			downgradeGroup = target
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if cacheGroup != "" && userId > 0 {
		_ = UpdateUserGroupCache(userId, cacheGroup)
	}
	if downgradeGroup != "" {
		return fmt.Sprintf("用户分组将回退到 %s", downgradeGroup), nil
	}
	return "", nil
}

// AdminDeleteUserSubscription hard-deletes a user subscription.
func AdminDeleteUserSubscription(userSubscriptionId int) (string, error) {
	if userSubscriptionId <= 0 {
		return "", errors.New("invalid userSubscriptionId")
	}
	now := common.GetTimestamp()
	cacheGroup := ""
	downgradeGroup := ""
	var userId int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		userId = sub.UserId
		target, err := downgradeUserGroupForSubscriptionTx(tx, &sub, now)
		if err != nil {
			return err
		}
		if target != "" {
			cacheGroup = target
			downgradeGroup = target
		}
		if err := tx.Where("id = ?", userSubscriptionId).Delete(&UserSubscription{}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if cacheGroup != "" && userId > 0 {
		_ = UpdateUserGroupCache(userId, cacheGroup)
	}
	if downgradeGroup != "" {
		return fmt.Sprintf("用户分组将回退到 %s", downgradeGroup), nil
	}
	return "", nil
}

type SubscriptionPreConsumeResult struct {
	UserSubscriptionId int
	PreConsumed        int64
	AmountTotal        int64
	AmountUsedBefore   int64
	AmountUsedAfter    int64
}

// ExpireDueSubscriptions marks expired subscriptions and handles group downgrade.
func ExpireDueSubscriptions(limit int) (int, error) {
	if limit <= 0 {
		limit = 200
	}
	now := GetDBTimestamp()
	var subs []UserSubscription
	if err := DB.Where("status = ? AND end_time > 0 AND end_time <= ?", "active", now).
		Order("end_time asc, id asc").
		Limit(limit).
		Find(&subs).Error; err != nil {
		return 0, err
	}
	if len(subs) == 0 {
		return 0, nil
	}
	expiredCount := 0
	userIds := make(map[int]struct{}, len(subs))
	for _, sub := range subs {
		if sub.UserId > 0 {
			userIds[sub.UserId] = struct{}{}
		}
	}
	for userId := range userIds {
		cacheGroup := ""
		err := DB.Transaction(func(tx *gorm.DB) error {
			res := tx.Model(&UserSubscription{}).
				Where("user_id = ? AND status = ? AND end_time > 0 AND end_time <= ?", userId, "active", now).
				Updates(map[string]interface{}{
					"status":     "expired",
					"updated_at": common.GetTimestamp(),
				})
			if res.Error != nil {
				return res.Error
			}
			expiredCount += int(res.RowsAffected)

			// If there's an active upgraded subscription, keep current group.
			var activeSub UserSubscription
			activeQuery := tx.Where("user_id = ? AND status = ? AND end_time > ? AND upgrade_group <> ''",
				userId, "active", now).
				Order("end_time desc, id desc").
				Limit(1).
				Find(&activeSub)
			if activeQuery.Error == nil && activeQuery.RowsAffected > 0 {
				return nil
			}

			// No active upgraded subscription, downgrade to previous group if needed.
			var lastExpired UserSubscription
			expiredQuery := tx.Where("user_id = ? AND status = ? AND upgrade_group <> ''",
				userId, "expired").
				Order("end_time desc, id desc").
				Limit(1).
				Find(&lastExpired)
			if expiredQuery.Error != nil || expiredQuery.RowsAffected == 0 {
				return nil
			}
			upgradeGroup := strings.TrimSpace(lastExpired.UpgradeGroup)
			prevGroup := strings.TrimSpace(lastExpired.PrevUserGroup)
			if upgradeGroup == "" || prevGroup == "" {
				return nil
			}
			currentGroup, err := getUserGroupByIdTx(tx, userId)
			if err != nil {
				return err
			}
			if currentGroup != upgradeGroup || currentGroup == prevGroup {
				return nil
			}
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("group", prevGroup).Error; err != nil {
				return err
			}
			cacheGroup = prevGroup
			return nil
		})
		if err != nil {
			return expiredCount, err
		}
		if cacheGroup != "" {
			_ = UpdateUserGroupCache(userId, cacheGroup)
		}
	}
	return expiredCount, nil
}

// SubscriptionPreConsumeRecord stores idempotent pre-consume operations per request.
type SubscriptionPreConsumeRecord struct {
	Id                 int    `json:"id"`
	RequestId          string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId             int    `json:"user_id" gorm:"index"`
	UserSubscriptionId int    `json:"user_subscription_id" gorm:"index"`
	PreConsumed        int64  `json:"pre_consumed" gorm:"type:bigint;not null;default:0"`
	Status             string `json:"status" gorm:"type:varchar(32);index"` // consumed/refunded
	CreatedAt          int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt          int64  `json:"updated_at" gorm:"bigint;index"`
}

func (r *SubscriptionPreConsumeRecord) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *SubscriptionPreConsumeRecord) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

func maybeResetUserSubscriptionWithPlanTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan, now int64) error {
	if tx == nil || sub == nil || plan == nil {
		return errors.New("invalid reset args")
	}
	if sub.NextResetTime > 0 && sub.NextResetTime > now {
		return nil
	}
	if NormalizeResetPeriod(plan.QuotaResetPeriod) == SubscriptionResetNever {
		return nil
	}
	baseUnix := sub.LastResetTime
	if baseUnix <= 0 {
		baseUnix = sub.StartTime
	}
	base := time.Unix(baseUnix, 0)
	next := calcNextResetTime(base, plan, sub.EndTime)
	advanced := false
	for next > 0 && next <= now {
		advanced = true
		base = time.Unix(next, 0)
		next = calcNextResetTime(base, plan, sub.EndTime)
	}
	if !advanced {
		if sub.NextResetTime == 0 && next > 0 {
			sub.NextResetTime = next
			sub.LastResetTime = base.Unix()
			return tx.Save(sub).Error
		}
		return nil
	}
	sub.AmountUsed = 0
	sub.MediaCreditsUsed = 0
	sub.LastResetTime = base.Unix()
	sub.NextResetTime = next
	return tx.Save(sub).Error
}

// PreConsumeUserSubscription pre-consumes quota from the user's current contract entitlement,
// or from legacy active subscriptions when no contract exists.
func PreConsumeUserSubscription(requestId string, userId int, modelName string, quotaType int, amount int64) (*SubscriptionPreConsumeResult, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	if strings.TrimSpace(requestId) == "" {
		return nil, errors.New("requestId is empty")
	}
	if amount <= 0 {
		return nil, errors.New("amount must be > 0")
	}
	now := GetDBTimestamp()

	returnValue := &SubscriptionPreConsumeResult{}

	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing SubscriptionPreConsumeRecord
		query := tx.Where("request_id = ?", requestId).Limit(1).Find(&existing)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			if existing.Status == "refunded" {
				return errors.New("subscription pre-consume already refunded")
			}
			return fillSubscriptionPreConsumeReturnFromRecordTx(tx, returnValue, existing)
		}

		subs, hasContract, contractStatus, err := getPreConsumableSubscriptionCandidatesTx(tx, userId, now)
		if err != nil {
			return err
		}
		if len(subs) == 0 {
			return noActiveSubscriptionError(hasContract)
		}
		allowReset := !hasContract || normalizeSubscriptionContractStatus(contractStatus) != SubscriptionContractStatusGrace
		for _, candidate := range subs {
			sub := candidate
			plan, err := getSubscriptionPlanByIdTx(tx, sub.PlanId)
			if err != nil {
				return err
			}
			if allowReset {
				if err := maybeResetUserSubscriptionWithPlanTx(tx, &sub, plan, now); err != nil {
					return err
				}
			}
			usedBefore := sub.AmountUsed
			if sub.AmountTotal > 0 {
				remain := sub.AmountTotal - usedBefore
				if remain < amount {
					continue
				}
			}
			record := &SubscriptionPreConsumeRecord{
				RequestId:          requestId,
				UserId:             userId,
				UserSubscriptionId: sub.Id,
				PreConsumed:        amount,
				Status:             "consumed",
			}
			if err := tx.Create(record).Error; err != nil {
				var dup SubscriptionPreConsumeRecord
				if err2 := tx.Where("request_id = ?", requestId).First(&dup).Error; err2 == nil {
					if dup.Status == "refunded" {
						return errors.New("subscription pre-consume already refunded")
					}
					return fillSubscriptionPreConsumeReturnFromRecordTx(tx, returnValue, dup)
				}
				return err
			}
			sub.AmountUsed += amount
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
			returnValue.UserSubscriptionId = sub.Id
			returnValue.PreConsumed = amount
			returnValue.AmountTotal = sub.AmountTotal
			returnValue.AmountUsedBefore = usedBefore
			returnValue.AmountUsedAfter = sub.AmountUsed
			return nil
		}
		return insufficientSubscriptionQuotaError(amount)
	})
	if err != nil {
		return nil, err
	}
	return returnValue, nil
}

func fillSubscriptionPreConsumeReturnFromRecordTx(tx *gorm.DB, out *SubscriptionPreConsumeResult, record SubscriptionPreConsumeRecord) error {
	if tx == nil || out == nil {
		return errors.New("invalid subscription pre-consume return args")
	}
	var sub UserSubscription
	if err := tx.Where("id = ?", record.UserSubscriptionId).First(&sub).Error; err != nil {
		return err
	}
	out.UserSubscriptionId = sub.Id
	out.PreConsumed = record.PreConsumed
	out.AmountTotal = sub.AmountTotal
	out.AmountUsedBefore = sub.AmountUsed
	out.AmountUsedAfter = sub.AmountUsed
	return nil
}

// RefundSubscriptionPreConsume is idempotent and refunds pre-consumed subscription quota by requestId.
func RefundSubscriptionPreConsume(requestId string) error {
	if strings.TrimSpace(requestId) == "" {
		return errors.New("requestId is empty")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var record SubscriptionPreConsumeRecord
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("request_id = ?", requestId).First(&record).Error; err != nil {
			return err
		}
		if record.Status == "refunded" {
			return nil
		}
		if record.PreConsumed <= 0 {
			record.Status = "refunded"
			return tx.Save(&record).Error
		}
		if err := PostConsumeUserSubscriptionDelta(record.UserSubscriptionId, -record.PreConsumed); err != nil {
			return err
		}
		record.Status = "refunded"
		return tx.Save(&record).Error
	})
}

// ResetDueSubscriptions resets subscriptions whose next_reset_time has passed.
func ResetDueSubscriptions(limit int) (int, error) {
	if limit <= 0 {
		limit = 200
	}
	now := GetDBTimestamp()
	var subs []UserSubscription
	if err := DB.Where("next_reset_time > 0 AND next_reset_time <= ? AND status = ?", now, "active").
		Order("next_reset_time asc").
		Limit(limit).
		Find(&subs).Error; err != nil {
		return 0, err
	}
	if len(subs) == 0 {
		return 0, nil
	}
	resetCount := 0
	for _, sub := range subs {
		subCopy := sub
		plan, err := getSubscriptionPlanByIdTx(nil, sub.PlanId)
		if err != nil || plan == nil {
			continue
		}
		err = DB.Transaction(func(tx *gorm.DB) error {
			var locked UserSubscription
			if err := tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ? AND next_reset_time > 0 AND next_reset_time <= ?", subCopy.Id, now).
				First(&locked).Error; err != nil {
				return nil
			}
			isGraceCurrent, err := isGraceContractCurrentEntitlementTx(tx, &locked)
			if err != nil {
				return err
			}
			if isGraceCurrent {
				return nil
			}
			if err := maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now); err != nil {
				return err
			}
			resetCount++
			return nil
		})
		if err != nil {
			return resetCount, err
		}
	}
	return resetCount, nil
}

// CleanupSubscriptionPreConsumeRecords removes old idempotency records to keep table small.
func CleanupSubscriptionPreConsumeRecords(olderThanSeconds int64) (int64, error) {
	if olderThanSeconds <= 0 {
		olderThanSeconds = 7 * 24 * 3600
	}
	cutoff := GetDBTimestamp() - olderThanSeconds
	res := DB.Where("updated_at < ?", cutoff).Delete(&SubscriptionPreConsumeRecord{})
	return res.RowsAffected, res.Error
}

type SubscriptionPlanInfo struct {
	PlanId    int
	PlanTitle string
}

func GetSubscriptionPlanInfoByUserSubscriptionId(userSubscriptionId int) (*SubscriptionPlanInfo, error) {
	if userSubscriptionId <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
	}
	cacheKey := fmt.Sprintf("sub:%d", userSubscriptionId)
	if cached, found, err := getSubscriptionPlanInfoCache().Get(cacheKey); err == nil && found {
		return &cached, nil
	}
	var sub UserSubscription
	if err := DB.Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
		return nil, err
	}
	plan, err := getSubscriptionPlanByIdTx(nil, sub.PlanId)
	if err != nil {
		return nil, err
	}
	info := &SubscriptionPlanInfo{
		PlanId:    sub.PlanId,
		PlanTitle: plan.Title,
	}
	_ = getSubscriptionPlanInfoCache().SetWithTTL(cacheKey, *info, subscriptionPlanInfoCacheTTL())
	return info, nil
}

// Update subscription used amount by delta (positive consume more, negative refund).
func PostConsumeUserSubscriptionDelta(userSubscriptionId int, delta int64) error {
	if userSubscriptionId <= 0 {
		return errors.New("invalid userSubscriptionId")
	}
	if delta == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userSubscriptionId).
			First(&sub).Error; err != nil {
			return err
		}
		newUsed := sub.AmountUsed + delta
		if newUsed < 0 {
			newUsed = 0
		}
		if sub.AmountTotal > 0 && newUsed > sub.AmountTotal {
			return fmt.Errorf("subscription used exceeds total, used=%d total=%d", newUsed, sub.AmountTotal)
		}
		sub.AmountUsed = newUsed
		return tx.Save(&sub).Error
	})
}
