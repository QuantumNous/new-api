package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
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

// Agent plan level (Lite/Plus/Max)
const (
	PlanLevelLite = "lite"
	PlanLevelPlus = "plus"
	PlanLevelMax  = "max"
)

// SubscriptionPlan.Tag values
const (
	PlanTagAgent = "agent" // 用于 Agent 实例的专用 usage plan
)

// UserPlanUsage window types
const (
	UserPlanUsagePeriodFiveHour = "five_hour"
	UserPlanUsagePeriodWeekly   = "weekly"
	UserPlanUsagePeriodMonthly  = "monthly"
)

// PlanLevelRank maps free-form level strings to a comparable rank for upgrade
// rules. Unknown levels sort low so the legacy plans (no level) rank below
// any agent plan.
var PlanLevelRank = map[string]int{
	"":            0,
	PlanLevelLite: 1,
	PlanLevelPlus: 2,
	PlanLevelMax:  3,
}

var (
	ErrSubscriptionOrderNotFound      = errors.New("subscription order not found")
	ErrSubscriptionOrderStatusInvalid = errors.New("subscription order status invalid")
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

// Subscription plan
type SubscriptionPlan struct {
	Id int `json:"id"`

	Title    string `json:"title" gorm:"type:varchar(128);not null"`
	Subtitle string `json:"subtitle" gorm:"type:varchar(255);default:''"`

	// Display money amount (follow existing code style: float64 for money)
	PriceAmount float64 `json:"price_amount" gorm:"type:decimal(10,6);not null;default:0"`
	Currency    string  `json:"currency" gorm:"type:varchar(8);not null;default:'USD'"`

	DurationUnit  string `json:"duration_unit" gorm:"type:varchar(16);not null;default:'month'"`
	DurationValue int    `json:"duration_value" gorm:"type:int;not null;default:1"`
	CustomSeconds int64  `json:"custom_seconds" gorm:"type:bigint;not null;default:0"`

	Enabled   bool `json:"enabled" gorm:"default:true"`
	SortOrder int  `json:"sort_order" gorm:"type:int;default:0"`

	AllowBalancePay *bool `json:"allow_balance_pay"`

	// Allow falling back to wallet balance after subscription quota is exhausted (empty = true)
	AllowWalletOverflow *bool `json:"allow_wallet_overflow"`

	StripePriceId         string `json:"stripe_price_id" gorm:"type:varchar(128);default:''"`
	CreemProductId        string `json:"creem_product_id" gorm:"type:varchar(128);default:''"`
	WaffoPancakeProductId string `json:"waffo_pancake_product_id" gorm:"type:varchar(128);default:''"`

	// Max purchases per user (0 = unlimited)
	MaxPurchasePerUser int `json:"max_purchase_per_user" gorm:"type:int;default:0"`

	// Upgrade user group after purchase (empty = no change)
	UpgradeGroup string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`

	// Downgrade user group on expiry (empty = revert to the group held before purchase)
	DowngradeGroup string `json:"downgrade_group" gorm:"type:varchar(64);default:''"`

	// Total quota (amount in quota units, 0 = unlimited)
	TotalAmount int64 `json:"total_amount" gorm:"type:bigint;not null;default:0"`

	// Quota reset period for plan
	QuotaResetPeriod        string `json:"quota_reset_period" gorm:"type:varchar(16);default:'never'"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;default:0"`

	// --- Agent plan extensions ---
	// Tag identifies the plan instance type. Agent-only flows filter on Tag=="agent".
	Tag string `json:"tag" gorm:"type:varchar(32);default:'';index"`
	// PlanLevel is the marketing tier (lite/plus/max) used for upgrade ordering.
	PlanLevel string `json:"plan_level" gorm:"type:varchar(16);default:'';index"`
	// Window quota caps. 0 means unlimited. Validated server-side before insert.
	FiveHourLimit int64 `json:"five_hour_limit" gorm:"type:bigint;default:0"`
	WeeklyLimit   int64 `json:"weekly_limit"    gorm:"type:bigint;default:0"`
	MonthlyLimit  int64 `json:"monthly_limit"   gorm:"type:bigint;default:0"`
	// AllowedModels is a JSON-encoded array of {model, ratio}. Empty means "no
	// restriction" (callers must treat absence as the existing free-for-all).
	// Stored as a `text` blob to keep migrations idempotent across SQLite/MySQL/PostgreSQL.
	AllowedModels string `json:"allowed_models" gorm:"type:text;default:''"`

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
	if p.AllowWalletOverflow == nil {
		p.AllowWalletOverflow = common.GetPointer(true)
	}
}

// Subscription order (payment -> webhook -> create UserSubscription)
type SubscriptionOrder struct {
	Id     int     `json:"id"`
	UserId int     `json:"user_id" gorm:"index"`
	PlanId int     `json:"plan_id" gorm:"index"`
	Money  float64 `json:"money"`

	TradeNo         string `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	Status          string `json:"status"`
	CreateTime      int64  `json:"create_time"`
	CompleteTime    int64  `json:"complete_time"`

	ProviderPayload string `json:"provider_payload" gorm:"type:text"`
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

// User subscription instance
type UserSubscription struct {
	Id     int `json:"id"`
	UserId int `json:"user_id" gorm:"index;index:idx_user_sub_active,priority:1"`
	PlanId int `json:"plan_id" gorm:"index"`

	AmountTotal int64 `json:"amount_total" gorm:"type:bigint;not null;default:0"`
	AmountUsed  int64 `json:"amount_used" gorm:"type:bigint;not null;default:0"`

	StartTime int64  `json:"start_time" gorm:"bigint"`
	EndTime   int64  `json:"end_time" gorm:"bigint;index;index:idx_user_sub_active,priority:3"`
	Status    string `json:"status" gorm:"type:varchar(32);index;index:idx_user_sub_active,priority:2"` // active/expired/cancelled/replaced

	Source string `json:"source" gorm:"type:varchar(32);default:'order'"` // order/admin

	LastResetTime int64 `json:"last_reset_time" gorm:"type:bigint;default:0"`
	NextResetTime int64 `json:"next_reset_time" gorm:"type:bigint;default:0;index"`

	UpgradeGroup  string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`
	PrevUserGroup string `json:"prev_user_group" gorm:"type:varchar(64);default:''"`

	// Downgrade target group on expiry (snapshot from plan; empty = revert to PrevUserGroup)
	DowngradeGroup string `json:"downgrade_group" gorm:"type:varchar(64);default:''"`

	// Whether wallet fallback is allowed after this subscription's quota is exhausted (snapshot from plan)
	AllowWalletOverflow bool `json:"allow_wallet_overflow"`

	// --- Agent plan snapshot fields ---
	Tag               string `json:"tag"                gorm:"type:varchar(32);default:''"`
	PlanLevel         string `json:"plan_level"         gorm:"type:varchar(16);default:''"`
	FiveHourLimitSnap int64  `json:"five_hour_limit_snap" gorm:"type:bigint;default:0"`
	WeeklyLimitSnap   int64  `json:"weekly_limit_snap"    gorm:"type:bigint;default:0"`
	MonthlyLimitSnap  int64  `json:"monthly_limit_snap"   gorm:"type:bigint;default:0"`
	AllowedModelsSnap string `json:"allowed_models_snap" gorm:"type:text;default:''"`
	// UpgradeFromId points to the UserSubscription this one replaced. 0 = first purchase.
	UpgradeFromId int `json:"upgrade_from_id" gorm:"type:int;default:0;index"`
	// ReplacedById points to the UserSubscription that replaced this one. 0 = still active or naturally expired.
	ReplacedById int `json:"replaced_by_id" gorm:"type:int;default:0;index"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (s *UserSubscription) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	s.CreatedAt = now
	s.UpdatedAt = now
	return nil
}

func (s *UserSubscription) BeforeUpdate(tx *gorm.DB) error {
	s.UpdatedAt = common.GetTimestamp()
	return nil
}

type SubscriptionSummary struct {
	Subscription *UserSubscription `json:"subscription"`
}

type SubscriptionResetResult struct {
	PlanId           int    `json:"plan_id"`
	MatchedCount     int    `json:"matched_count"`
	ResetCount       int    `json:"reset_count"`
	UserCount        int    `json:"user_count"`
	AdvanceResetTime bool   `json:"advance_reset_time"`
	PlanTitle        string `json:"-"`
	AffectedUserIds  []int  `json:"-"`
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
	var group string
	if err := tx.Model(&User{}).Where("id = ?", userId).Select(commonGroupCol).Find(&group).Error; err != nil {
		return "", err
	}
	return group, nil
}

func downgradeUserGroupForSubscriptionTx(tx *gorm.DB, sub *UserSubscription, now int64) (string, error) {
	if tx == nil || sub == nil {
		return "", errors.New("invalid downgrade args")
	}
	downgradeGroup := strings.TrimSpace(sub.DowngradeGroup)
	upgradeGroup := strings.TrimSpace(sub.UpgradeGroup)
	// Nothing to do if neither an explicit downgrade target nor an upgrade snapshot exists.
	if downgradeGroup == "" && upgradeGroup == "" {
		return "", nil
	}
	currentGroup, err := getUserGroupByIdTx(tx, sub.UserId)
	if err != nil {
		return "", err
	}
	// If another active upgraded subscription exists, keep the current group.
	var activeSub UserSubscription
	activeQuery := tx.Where("user_id = ? AND status = ? AND end_time > ? AND id <> ? AND upgrade_group <> ''",
		sub.UserId, "active", now, sub.Id).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&activeSub)
	if activeQuery.Error == nil && activeQuery.RowsAffected > 0 {
		return "", nil
	}
	// Determine the downgrade target: an explicit downgrade group takes precedence,
	// otherwise revert to the group held before purchase (legacy behavior).
	target := downgradeGroup
	if target == "" {
		// Legacy behavior: only revert when the subscription actually elevated the user.
		if currentGroup != upgradeGroup {
			return "", nil
		}
		target = strings.TrimSpace(sub.PrevUserGroup)
	}
	if target == "" || target == currentGroup {
		return "", nil
	}
	if err := tx.Model(&User{}).Where("id = ?", sub.UserId).
		Update("group", target).Error; err != nil {
		return "", err
	}
	return target, nil
}

func CreateUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string) (*UserSubscription, error) {
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
	allowWalletOverflow := true
	if plan.AllowWalletOverflow != nil {
		allowWalletOverflow = *plan.AllowWalletOverflow
	}
	sub := &UserSubscription{
		UserId:              userId,
		PlanId:              plan.Id,
		AmountTotal:         plan.TotalAmount,
		AmountUsed:          0,
		StartTime:           now.Unix(),
		EndTime:             endUnix,
		Status:              "active",
		Source:              source,
		LastResetTime:       lastReset,
		NextResetTime:       nextReset,
		UpgradeGroup:        upgradeGroup,
		PrevUserGroup:       prevGroup,
		DowngradeGroup:      strings.TrimSpace(plan.DowngradeGroup),
		AllowWalletOverflow: allowWalletOverflow,
		CreatedAt:           common.GetTimestamp(),
		UpdatedAt:           common.GetTimestamp(),
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
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}
	var logUserId int
	var logPlanTitle string
	var logMoney float64
	var logPaymentMethod string
	var upgradeGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
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
				UserId:        order.UserId,
				Amount:        0,
				Money:         order.Money,
				TradeNo:       order.TradeNo,
				PaymentMethod: order.PaymentMethod,
				CreateTime:    order.CreateTime,
				CompleteTime:  now,
				Status:        common.TopUpStatusSuccess,
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
	if topup.CreateTime == 0 {
		topup.CreateTime = order.CreateTime
	}
	topup.CompleteTime = now
	topup.Status = common.TopUpStatusSuccess
	return tx.Save(&topup).Error
}

func ExpireSubscriptionOrder(tradeNo string, expectedPaymentProvider string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
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

// PurchaseSubscriptionWithBalance creates (or upgrades to) a subscription by
// deducting the user's wallet quota.
//
// 升级分流（agent 实例）：
//   - 若用户已有 active agent-tagged sub：
//   - 新 plan.PlanLevel <= 旧 sub.PlanLevel → 拒绝
//   - 否则走 UpgradeUserSubscriptionTx；按旧 plan 剩余 quota 的折算金额抵扣
//     新 plan 的 quota 扣款；旧 sub 标记 replaced，新 sub 携带新 plan snapshot。
//   - 无 active sub：按原路径创建新 sub。
func PurchaseSubscriptionWithBalance(userId int, planId int) error {
	if userId <= 0 || planId <= 0 {
		return errors.New("invalid userId or planId")
	}

	var logPlanTitle string
	var logMoney float64
	var chargedQuota int
	var upgradeGroup string
	var isUpgrade bool
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

		requiredQuota, err := calcSubscriptionBalanceQuota(plan.PriceAmount)
		if err != nil {
			return err
		}

		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}

		// ---- 升级分流（agent 实例） ----
		oldSub, oldErr := getActiveAgentSubscriptionTx(tx, userId)
		if oldErr != nil {
			return oldErr
		}
		if oldSub != nil {
			if ValidatePlanLevel(plan.PlanLevel) != nil {
				return ValidatePlanLevel(plan.PlanLevel)
			}
			newRank := PlanLevelRank[plan.PlanLevel]
			oldRank := PlanLevelRank[oldSub.PlanLevel]
			if newRank <= oldRank {
				return fmt.Errorf("不允许降级或选择同级套餐（当前等级 %s，目标等级 %s）",
					oldSub.PlanLevel, plan.PlanLevel)
			}
			oldPlan, gpErr := getSubscriptionPlanByIdTx(tx, oldSub.PlanId)
			if gpErr != nil {
				return gpErr
			}
			discount, _ := ComputeUpgradeDiscount(oldSub, oldPlan, plan)
			netPrice := plan.PriceAmount - discount
			if netPrice < 0 {
				netPrice = 0
			}
			netQuota, qErr := calcSubscriptionBalanceQuota(netPrice)
			if qErr != nil {
				return qErr
			}
			if netQuota > 0 && user.Quota < netQuota {
				return errors.New("余额不足")
			}
			if netQuota > 0 {
				if err := tx.Model(&User{}).Where("id = ?", userId).
					Update("quota", gorm.Expr("quota - ?", netQuota)).Error; err != nil {
					return err
				}
			}
			if _, err := UpgradeUserSubscriptionTx(tx, userId, oldSub, plan); err != nil {
				return err
			}
			now := common.GetTimestamp()
			tradeNo := fmt.Sprintf("SUBUPGUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().UnixNano())
			order := &SubscriptionOrder{
				UserId:          userId,
				PlanId:          plan.Id,
				Money:           netPrice,
				TradeNo:         tradeNo,
				PaymentMethod:   PaymentMethodBalance,
				PaymentProvider: PaymentProviderBalance,
				Status:          common.TopUpStatusSuccess,
				CreateTime:      now,
				CompleteTime:    now,
				ProviderPayload: fmt.Sprintf("upgrade_from=%d;gross=%.4f;charged_quota=%d", oldSub.Id, plan.PriceAmount, netQuota),
			}
			if err := tx.Create(order).Error; err != nil {
				return err
			}
			logPlanTitle = plan.Title
			logMoney = netPrice
			chargedQuota = netQuota
			upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
			isUpgrade = true
			return nil
		}

		// ---- 原路径：首次购买 ----
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
			Money:           plan.PriceAmount,
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

		logPlanTitle = plan.Title
		logMoney = plan.PriceAmount
		chargedQuota = requiredQuota
		upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
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
	if isUpgrade {
		msg := fmt.Sprintf("升级套餐成功: %s，抵扣后实付: %.2f，扣除额度: %d", logPlanTitle, logMoney, chargedQuota)
		RecordLog(userId, LogTypeTopup, msg)
	} else {
		msg := fmt.Sprintf("使用余额购买订阅成功，套餐: %s，支付金额: %.2f，扣除额度: %d", logPlanTitle, logMoney, chargedQuota)
		RecordLog(userId, LogTypeTopup, msg)
	}
	return nil
}

// getActiveAgentSubscriptionTx 在事务内取用户当前唯一活跃 agent 订阅。
// 没找到时返回 (nil, nil)，避免调用方再判断 record-not-found。
func getActiveAgentSubscriptionTx(tx *gorm.DB, userId int) (*UserSubscription, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	q := DB
	if tx != nil {
		q = tx
	}
	now := GetDBTimestamp()
	var sub UserSubscription
	err := q.Where("user_id = ? AND status = ? AND end_time > ? AND tag = ?",
		userId, "active", now, PlanTagAgent).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if sub.Id == 0 {
		return nil, nil
	}
	return &sub, nil
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

// HasActiveUserSubscription returns whether the user has any active subscription.
// This is a lightweight existence check to avoid heavy pre-consume transactions.
func HasActiveUserSubscription(userId int) (bool, error) {
	if userId <= 0 {
		return false, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	var count int64
	if err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// UserActiveSubscriptionsAllowWalletOverflow returns whether wallet balance may be used
// after the user's subscription quota is exhausted. A single active subscription that
// disallows wallet overflow (allow_wallet_overflow = false) blocks the fallback.
func UserActiveSubscriptionsAllowWalletOverflow(userId int) (bool, error) {
	if userId <= 0 {
		return false, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	var strictCount int64
	if err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ? AND end_time > ? AND allow_wallet_overflow = ?",
			userId, "active", now, false).
		Count(&strictCount).Error; err != nil {
		return false, err
	}
	return strictCount == 0, nil
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
	result := make([]SubscriptionSummary, 0, len(subs))
	for _, sub := range subs {
		subCopy := sub
		result = append(result, SubscriptionSummary{
			Subscription: &subCopy,
		})
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
		if err := lockForUpdate(tx).
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
		if err := lockForUpdate(tx).
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

func resetUserSubscriptionTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan, now int64, advanceResetTime bool) error {
	if tx == nil || sub == nil || plan == nil {
		return errors.New("invalid reset args")
	}
	sub.AmountUsed = 0
	if advanceResetTime {
		nextReset := calcNextResetTime(time.Unix(now, 0), plan, sub.EndTime)
		sub.NextResetTime = nextReset
		if nextReset > 0 {
			sub.LastResetTime = now
		} else {
			sub.LastResetTime = 0
		}
	}
	return tx.Save(sub).Error
}

func buildSubscriptionResetResult(plan *SubscriptionPlan, subs []UserSubscription, advanceResetTime bool) *SubscriptionResetResult {
	userIds := make([]int, 0, len(subs))
	seenUsers := make(map[int]struct{}, len(subs))
	for _, sub := range subs {
		if _, ok := seenUsers[sub.UserId]; ok {
			continue
		}
		seenUsers[sub.UserId] = struct{}{}
		userIds = append(userIds, sub.UserId)
	}
	return &SubscriptionResetResult{
		PlanId:           plan.Id,
		MatchedCount:     len(subs),
		ResetCount:       len(subs),
		UserCount:        len(userIds),
		AdvanceResetTime: advanceResetTime,
		PlanTitle:        plan.Title,
		AffectedUserIds:  userIds,
	}
}

func adminResetUserSubscriptionsByPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, now int64, advanceResetTime bool) (*SubscriptionResetResult, error) {
	if tx == nil || plan == nil {
		return nil, errors.New("invalid reset args")
	}
	var subs []UserSubscription
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ? AND plan_id = ? AND status = ? AND end_time > ?", userId, plan.Id, "active", now).
		Order("end_time asc, id asc").
		Find(&subs).Error; err != nil {
		return nil, err
	}
	if len(subs) == 0 {
		return nil, errors.New("该用户没有有效的此套餐订阅")
	}
	for i := range subs {
		if err := resetUserSubscriptionTx(tx, &subs[i], plan, now, advanceResetTime); err != nil {
			return nil, err
		}
	}
	return buildSubscriptionResetResult(plan, subs, advanceResetTime), nil
}

func adminResetPlanSubscriptionsTx(tx *gorm.DB, plan *SubscriptionPlan, now int64, advanceResetTime bool) (*SubscriptionResetResult, error) {
	if tx == nil || plan == nil {
		return nil, errors.New("invalid reset args")
	}
	var subs []UserSubscription
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("plan_id = ? AND status = ? AND end_time > ?", plan.Id, "active", now).
		Order("user_id asc, end_time asc, id asc").
		Find(&subs).Error; err != nil {
		return nil, err
	}
	for i := range subs {
		if err := resetUserSubscriptionTx(tx, &subs[i], plan, now, advanceResetTime); err != nil {
			return nil, err
		}
	}
	return buildSubscriptionResetResult(plan, subs, advanceResetTime), nil
}

func AdminResetUserSubscriptionsByPlan(userId int, planId int, advanceResetTime bool) (*SubscriptionResetResult, error) {
	if userId <= 0 || planId <= 0 {
		return nil, errors.New("invalid userId or planId")
	}
	var result *SubscriptionResetResult
	now := GetDBTimestamp()
	err := DB.Transaction(func(tx *gorm.DB) error {
		plan, err := getSubscriptionPlanByIdTx(tx, planId)
		if err != nil {
			return err
		}
		result, err = adminResetUserSubscriptionsByPlanTx(tx, userId, plan, now, advanceResetTime)
		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func AdminResetPlanSubscriptions(planId int, advanceResetTime bool) (*SubscriptionResetResult, error) {
	if planId <= 0 {
		return nil, errors.New("invalid planId")
	}
	var result *SubscriptionResetResult
	now := GetDBTimestamp()
	err := DB.Transaction(func(tx *gorm.DB) error {
		plan, err := getSubscriptionPlanByIdTx(tx, planId)
		if err != nil {
			return err
		}
		result, err = adminResetPlanSubscriptionsTx(tx, plan, now, advanceResetTime)
		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
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

			// Find the most recently expired subscription that defines a group transition
			// (an explicit downgrade target or an upgrade snapshot to revert).
			var lastExpired UserSubscription
			expiredQuery := tx.Where("user_id = ? AND status = ? AND (downgrade_group <> '' OR upgrade_group <> '')",
				userId, "expired").
				Order("end_time desc, id desc").
				Limit(1).
				Find(&lastExpired)
			if expiredQuery.Error != nil || expiredQuery.RowsAffected == 0 {
				return nil
			}
			currentGroup, err := getUserGroupByIdTx(tx, userId)
			if err != nil {
				return err
			}
			// An explicit downgrade group takes precedence; otherwise revert to the
			// group held before purchase (legacy behavior, only when the subscription
			// actually elevated the user).
			target := strings.TrimSpace(lastExpired.DowngradeGroup)
			if target == "" {
				upgradeGroup := strings.TrimSpace(lastExpired.UpgradeGroup)
				prevGroup := strings.TrimSpace(lastExpired.PrevUserGroup)
				if upgradeGroup == "" || prevGroup == "" {
					return nil
				}
				if currentGroup != upgradeGroup {
					return nil
				}
				target = prevGroup
			}
			if target == "" || target == currentGroup {
				return nil
			}
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("group", target).Error; err != nil {
				return err
			}
			cacheGroup = target
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
	sub.LastResetTime = base.Unix()
	sub.NextResetTime = next
	return tx.Save(sub).Error
}

// PreConsumeUserSubscription pre-consumes from any active subscription total quota.
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
			var sub UserSubscription
			if err := tx.Where("id = ?", existing.UserSubscriptionId).First(&sub).Error; err != nil {
				return err
			}
			returnValue.UserSubscriptionId = sub.Id
			returnValue.PreConsumed = existing.PreConsumed
			returnValue.AmountTotal = sub.AmountTotal
			returnValue.AmountUsedBefore = sub.AmountUsed
			returnValue.AmountUsedAfter = sub.AmountUsed
			return nil
		}

		var subs []UserSubscription
		if err := lockForUpdate(tx).
			Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
			Order("end_time asc, id asc").
			Find(&subs).Error; err != nil {
			return errors.New("no active subscription")
		}
		if len(subs) == 0 {
			return errors.New("no active subscription")
		}
		for _, candidate := range subs {
			sub := candidate
			plan, err := getSubscriptionPlanByIdTx(tx, sub.PlanId)
			if err != nil {
				return err
			}
			if err := maybeResetUserSubscriptionWithPlanTx(tx, &sub, plan, now); err != nil {
				return err
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
					returnValue.UserSubscriptionId = sub.Id
					returnValue.PreConsumed = dup.PreConsumed
					returnValue.AmountTotal = sub.AmountTotal
					returnValue.AmountUsedBefore = sub.AmountUsed
					returnValue.AmountUsedAfter = sub.AmountUsed
					return nil
				}
				return err
			}
			sub.AmountUsed += amount
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
			// Agent plan：把预扣同步累加到 5h/周/月三窗口计数器。
			// 非 agent sub 不写入三窗口（与既有 AmountUsed 行为完全兼容）。
			if sub.Tag == PlanTagAgent {
				for _, pt := range []string{UserPlanUsagePeriodFiveHour, UserPlanUsagePeriodWeekly, UserPlanUsagePeriodMonthly} {
					start, end, perr := ComputeCurrentPeriod(pt, sub.StartTime, now, time.Local)
					if perr != nil {
						continue
					}
					if uerr := UpsertUserPlanUsage(tx, sub.Id, sub.UserId, pt, start, end, amount); uerr != nil {
						return uerr
					}
				}
			}
			returnValue.UserSubscriptionId = sub.Id
			returnValue.PreConsumed = amount
			returnValue.AmountTotal = sub.AmountTotal
			returnValue.AmountUsedBefore = usedBefore
			returnValue.AmountUsedAfter = sub.AmountUsed
			return nil
		}
		return fmt.Errorf("subscription quota insufficient, need=%d", amount)
	})
	if err != nil {
		return nil, err
	}
	return returnValue, nil
}

// RefundSubscriptionPreConsume is idempotent and refunds pre-consumed subscription quota by requestId.
func RefundSubscriptionPreConsume(requestId string) error {
	if strings.TrimSpace(requestId) == "" {
		return errors.New("requestId is empty")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var record SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).
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
			if err := lockForUpdate(tx).
				Where("id = ? AND next_reset_time > 0 AND next_reset_time <= ?", subCopy.Id, now).
				First(&locked).Error; err != nil {
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
		if err := lockForUpdate(tx).
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
		if err := tx.Save(&sub).Error; err != nil {
			return err
		}
		// Agent plan：把 delta 同步到 5h/周/月三窗口。Refund/Settle 都会走这里。
		// 注意我们直接用 now 计算窗口；如果 delta 来自跨桶的 refund（例如 5h
		// 桶已过期但 PreConsumeRecord 仍记录旧窗口），按当前窗口调整可能错位——
		// 这是已知的折中：3 窗口是展示用，不参与强扣费拦截，跨桶差异会在周期
		// 清理中自然消失。
		if sub.Tag == PlanTagAgent {
			now := GetDBTimestamp()
			for _, pt := range []string{UserPlanUsagePeriodFiveHour, UserPlanUsagePeriodWeekly, UserPlanUsagePeriodMonthly} {
				start, end, perr := ComputeCurrentPeriod(pt, sub.StartTime, now, time.Local)
				if perr != nil {
					continue
				}
				if uerr := UpsertUserPlanUsage(tx, sub.Id, sub.UserId, pt, start, end, delta); uerr != nil {
					return uerr
				}
			}
		}
		return nil
	})
}

// -----------------------------------------------------------------------------
// Agent Plan extensions: window counters + upgrade flow.
// 仅在接口层（数据模型 + 查询）实现，不接入 relay 拒绝路径。
// -----------------------------------------------------------------------------

// UserPlanUsage tracks quota consumed within a time-bucketed window.
// One row per (UserSubscription, PeriodType, PeriodStart); the window length
// depends on PeriodType (5h / weekly / monthly from purchase anchor).
type UserPlanUsage struct {
	Id                 int64  `json:"id" gorm:"primaryKey"`
	UserId             int    `json:"user_id" gorm:"index:idx_user_plan_usage_lookup,priority:1"`
	UserSubscriptionId int    `json:"user_subscription_id" gorm:"index;uniqueIndex:idx_user_plan_usage_window,priority:1"`
	PeriodType         string `json:"period_type" gorm:"type:varchar(16);uniqueIndex:idx_user_plan_usage_window,priority:2"`
	PeriodStart        int64  `json:"period_start" gorm:"bigint;uniqueIndex:idx_user_plan_usage_window,priority:3"`
	PeriodEnd          int64  `json:"period_end" gorm:"bigint"`
	QuotaUsed          int64  `json:"quota_used" gorm:"type:bigint;default:0"`
	UpdatedAt          int64  `json:"updated_at" gorm:"bigint;index"`
	CreatedAt          int64  `json:"created_at" gorm:"bigint"`
}

func (u *UserPlanUsage) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	u.CreatedAt = now
	u.UpdatedAt = now
	return nil
}

func (u *UserPlanUsage) BeforeUpdate(tx *gorm.DB) error {
	u.UpdatedAt = common.GetTimestamp()
	return nil
}

// WindowUsage is the read-side summary returned by GetUserPlanUsageSummary.
// Limit=0 means "no configured cap"; Remaining is reported as math.MaxInt64 in
// that case so callers can render an "unlimited" badge.
type WindowUsage struct {
	PeriodType  string `json:"period_type"`
	PeriodStart int64  `json:"period_start"`
	PeriodEnd   int64  `json:"period_end"`
	Used        int64  `json:"used"`
	Limit       int64  `json:"limit"`
	Remaining   int64  `json:"remaining"`
}

// ValidatePlanLevel returns nil if level is empty or one of the supported
// tiers. Used by admin handlers to reject typos before persisting.
func ValidatePlanLevel(level string) error {
	switch strings.TrimSpace(level) {
	case "", PlanLevelLite, PlanLevelPlus, PlanLevelMax:
		return nil
	}
	return fmt.Errorf("invalid plan level: %s", level)
}

// ValidatePlanTag returns nil if tag is empty or one of the known tags.
func ValidatePlanTag(tag string) error {
	switch strings.TrimSpace(tag) {
	case "", PlanTagAgent:
		return nil
	}
	return fmt.Errorf("invalid plan tag: %s", tag)
}

// ComputeCurrentPeriod returns the [start, end] window for a given PeriodType
// relative to `now`, anchored on the user's subscription start time for the
// monthly window. End is exclusive.
//   - five_hour: aligned to 0/5/10/15/20 hour buckets in local time. The final
//     bucket (20:00–24:00) is only 4 hours long — caller does NOT need to clamp.
//   - weekly: Monday 00:00 → next Monday 00:00 in local time.
//   - monthly: rolling 30-day anchor from subStartTime, advancing by AddDate(0,1,0).
func ComputeCurrentPeriod(periodType string, subStartTime, now int64, loc *time.Location) (int64, int64, error) {
	if now <= 0 {
		return 0, 0, errors.New("invalid now")
	}
	if loc == nil {
		loc = time.Local
	}
	nowTime := time.Unix(now, 0).In(loc)
	switch periodType {
	case UserPlanUsagePeriodFiveHour:
		// 五小时窗口：每日 0/5/10/15/20 整点分桶。hour >= 20 时 slot=4 但 end 截到当日 24:00。
		dayStart := time.Date(nowTime.Year(), nowTime.Month(), nowTime.Day(), 0, 0, 0, 0, loc)
		slot := nowTime.Hour() / 5
		if slot > 4 {
			slot = 4
		}
		start := dayStart.Add(time.Duration(slot) * 5 * time.Hour)
		end := start.Add(5 * time.Hour)
		if !end.After(dayStart.Add(24 * time.Hour)) {
			// 正常桶
		} else {
			// 最后一桶实际只有 4h，但仍以 end-of-day 作为 period_end（24:00 = 次日 0:00）
			end = dayStart.Add(24 * time.Hour)
		}
		return start.Unix(), end.Unix(), nil
	case UserPlanUsagePeriodWeekly:
		// 周窗口：周一 0:00 → 下周一 0:00。
		weekday := int(nowTime.Weekday()) // Sunday=0
		if weekday == 0 {
			weekday = 7
		}
		daysSinceMonday := weekday - 1
		monday := time.Date(nowTime.Year(), nowTime.Month(), nowTime.Day(), 0, 0, 0, 0, loc).
			AddDate(0, 0, -daysSinceMonday)
		nextMonday := monday.AddDate(0, 0, 7)
		return monday.Unix(), nextMonday.Unix(), nil
	case UserPlanUsagePeriodMonthly:
		// 月窗口：从 subStartTime 锚点逐月滚动。
		if subStartTime <= 0 {
			return 0, 0, errors.New("subStartTime required for monthly period")
		}
		anchor := time.Unix(subStartTime, 0).In(loc)
		current := anchor
		for {
			next := current.AddDate(0, 1, 0)
			if next.Unix() > now {
				break
			}
			current = next
		}
		return current.Unix(), current.AddDate(0, 1, 0).Unix(), nil
	default:
		return 0, 0, fmt.Errorf("invalid period type: %s", periodType)
	}
}

// UpsertUserPlanUsage 幂等累加 delta 到当前窗口。如果对应窗口尚未结束则复用
// period_start 对应的行；如果窗口已结束则视为过期（不主动删除，由
// ResetDueUserPlanUsage 周期性清理）。
func UpsertUserPlanUsage(tx *gorm.DB, userSubscriptionId int, userId int, periodType string, periodStart, periodEnd int64, delta int64) error {
	if tx == nil || userSubscriptionId <= 0 || userId <= 0 {
		return errors.New("invalid usage args")
	}
	if periodStart <= 0 || periodEnd <= periodStart {
		return errors.New("invalid period range")
	}
	if delta == 0 {
		return nil
	}
	var row UserPlanUsage
	err := tx.Where("user_subscription_id = ? AND period_type = ? AND period_start = ?",
		userSubscriptionId, periodType, periodStart).
		First(&row).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = UserPlanUsage{
			UserId:             userId,
			UserSubscriptionId: userSubscriptionId,
			PeriodType:         periodType,
			PeriodStart:        periodStart,
			PeriodEnd:          periodEnd,
			QuotaUsed:          0,
		}
	}
	newUsed := row.QuotaUsed + delta
	if newUsed < 0 {
		newUsed = 0
	}
	row.QuotaUsed = newUsed
	if row.Id == 0 {
		row.UserId = userId
		row.UserSubscriptionId = userSubscriptionId
		row.PeriodType = periodType
		row.PeriodStart = periodStart
		row.PeriodEnd = periodEnd
		return tx.Create(&row).Error
	}
	return tx.Save(&row).Error
}

// GetUserPlanUsageSummary returns current-window usage for an active
// subscription. Windows older than `now` are skipped (their rows are left to
// the periodic cleanup task). Limits come from the UserSubscription snapshot
// fields so they survive plan edits.
func GetUserPlanUsageSummary(userSubscriptionId int) (fiveHour, weekly, monthly *WindowUsage, err error) {
	if userSubscriptionId <= 0 {
		return nil, nil, nil, errors.New("invalid userSubscriptionId")
	}
	var sub UserSubscription
	if err := DB.Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
		return nil, nil, nil, err
	}
	now := GetDBTimestamp()
	build := func(periodType string, snap int64) (*WindowUsage, error) {
		start, end, err := ComputeCurrentPeriod(periodType, sub.StartTime, now, time.Local)
		if err != nil {
			return nil, err
		}
		var row UserPlanUsage
		err = DB.Where("user_subscription_id = ? AND period_type = ? AND period_start = ?",
			userSubscriptionId, periodType, start).First(&row).Error
		used := int64(0)
		if err == nil {
			used = row.QuotaUsed
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		limit := snap
		remaining := int64(1 << 62) // 表示「无限」
		if limit > 0 {
			remaining = limit - used
			if remaining < 0 {
				remaining = 0
			}
		}
		return &WindowUsage{
			PeriodType:  periodType,
			PeriodStart: start,
			PeriodEnd:   end,
			Used:        used,
			Limit:       limit,
			Remaining:   remaining,
		}, nil
	}
	fiveHour, err = build(UserPlanUsagePeriodFiveHour, sub.FiveHourLimitSnap)
	if err != nil {
		return nil, nil, nil, err
	}
	weekly, err = build(UserPlanUsagePeriodWeekly, sub.WeeklyLimitSnap)
	if err != nil {
		return nil, nil, nil, err
	}
	monthly, err = build(UserPlanUsagePeriodMonthly, sub.MonthlyLimitSnap)
	if err != nil {
		return nil, nil, nil, err
	}
	return fiveHour, weekly, monthly, nil
}

// ResetDueUserPlanUsage deletes usage rows whose period has ended more than
// retainSeconds ago. Called from the periodic reset task.
func ResetDueUserPlanUsage(retainSeconds int64) (int64, error) {
	if retainSeconds <= 0 {
		retainSeconds = 24 * 3600
	}
	now := GetDBTimestamp()
	cutoff := now - retainSeconds
	res := DB.Where("period_end > 0 AND period_end <= ?", cutoff).Delete(&UserPlanUsage{})
	return res.RowsAffected, res.Error
}

// ComputeUpgradeDiscount estimates how much quota value (in money) the user
// can deduct from a new plan purchase given their current active subscription.
// Returns discountMoney in the same unit as plan.PriceAmount. Both quota and
// money are clamped to >= 0 to keep arithmetic safe.
func ComputeUpgradeDiscount(oldSub *UserSubscription, oldPlan, newPlan *SubscriptionPlan) (discountMoney float64, usedMoney float64) {
	if oldSub == nil || oldPlan == nil || newPlan == nil {
		return 0, 0
	}
	if oldPlan.PriceAmount <= 0 || oldPlan.TotalAmount <= 0 {
		return 0, 0
	}
	remainQuota := oldSub.AmountTotal - oldSub.AmountUsed
	if remainQuota <= 0 {
		return 0, 0
	}
	pricePerUnit := oldPlan.PriceAmount / float64(oldPlan.TotalAmount)
	discountMoney = pricePerUnit * float64(remainQuota)
	usedMoney = pricePerUnit * float64(oldSub.AmountUsed)
	return discountMoney, usedMoney
}

// UpgradeUserSubscriptionTx deactivates the user's current active subscription
// (marking it `replaced`) and creates a new one based on newPlan. The caller is
// responsible for charging the wallet balance / forwarding to the payment
// gateway for the net (newPlan.PriceAmount - discountMoney) before invoking
// this function. This function does NOT move quota — quota is reset by the new
// plan's snapshot fields.
func UpgradeUserSubscriptionTx(tx *gorm.DB, userId int, oldSub *UserSubscription, newPlan *SubscriptionPlan) (*UserSubscription, error) {
	if tx == nil {
		return nil, errors.New("tx is nil")
	}
	if userId <= 0 || newPlan == nil || newPlan.Id <= 0 {
		return nil, errors.New("invalid upgrade args")
	}
	now := GetDBTimestamp()
	newSub, err := CreateUserSubscriptionFromPlanTx(tx, userId, newPlan, "upgrade")
	if err != nil {
		return nil, err
	}
	newSub.UpgradeFromId = 0
	if oldSub != nil && oldSub.Id > 0 {
		newSub.UpgradeFromId = oldSub.Id
		// 快照旧 plan 的 agent 字段（即使没有也复制空值，保持一致）
		newSub.Tag = newPlan.Tag
		newSub.PlanLevel = newPlan.PlanLevel
		newSub.FiveHourLimitSnap = newPlan.FiveHourLimit
		newSub.WeeklyLimitSnap = newPlan.WeeklyLimit
		newSub.MonthlyLimitSnap = newPlan.MonthlyLimit
		newSub.AllowedModelsSnap = newPlan.AllowedModels
		if err := tx.Save(newSub).Error; err != nil {
			return nil, err
		}
		oldSub.Status = "replaced"
		oldSub.ReplacedById = newSub.Id
		oldSub.EndTime = now
		oldSub.UpdatedAt = now
		if err := tx.Save(oldSub).Error; err != nil {
			return nil, err
		}
	} else {
		newSub.Tag = newPlan.Tag
		newSub.PlanLevel = newPlan.PlanLevel
		newSub.FiveHourLimitSnap = newPlan.FiveHourLimit
		newSub.WeeklyLimitSnap = newPlan.WeeklyLimit
		newSub.MonthlyLimitSnap = newPlan.MonthlyLimit
		newSub.AllowedModelsSnap = newPlan.AllowedModels
		if err := tx.Save(newSub).Error; err != nil {
			return nil, err
		}
	}
	return newSub, nil
}

// GetUserActiveAgentSubscription returns the single active agent-tagged
// subscription for a user, or nil if none. Order is `end_time desc, id desc`
// so the longest-lasting active sub wins (only ever one in practice).
func GetUserActiveAgentSubscription(userId int) (*UserSubscription, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	now := GetDBTimestamp()
	var sub UserSubscription
	err := DB.Where("user_id = ? AND status = ? AND end_time > ? AND tag = ?",
		userId, "active", now, PlanTagAgent).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if sub.Id == 0 {
		return nil, nil
	}
	return &sub, nil
}

// HasActiveAgentSubscription returns whether the user has any active agent-tagged
// subscription. Mirrors HasActiveUserSubscription but filters on tag="agent".
func HasActiveAgentSubscription(userId int) (bool, error) {
	if userId <= 0 {
		return false, errors.New("invalid userId")
	}
	now := GetDBTimestamp()
	var count int64
	if err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ? AND end_time > ? AND tag = ?",
			userId, "active", now, PlanTagAgent).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// IsModelAllowedBySubscription returns whether `modelName` is permitted by the
// user subscription's AllowedModelsSnap. Empty allow-list means unrestricted.
func IsModelAllowedBySubscription(userSubscriptionId int, modelName string) (bool, error) {
	if userSubscriptionId <= 0 {
		return false, errors.New("invalid userSubscriptionId")
	}
	if strings.TrimSpace(modelName) == "" {
		return true, nil
	}
	var snap string
	if err := DB.Model(&UserSubscription{}).
		Where("id = ?", userSubscriptionId).
		Pluck("allowed_models_snap", &snap).Error; err != nil {
		return false, err
	}
	if strings.TrimSpace(snap) == "" {
		return true, nil
	}
	var entries []PlanAllowedModel
	if err := common.UnmarshalJsonStr(snap, &entries); err != nil {
		// 损坏的 JSON 视作未限制，避免误拒。
		return true, nil
	}
	if len(entries) == 0 {
		return true, nil
	}
	for _, e := range entries {
		if strings.EqualFold(strings.TrimSpace(e.Model), strings.TrimSpace(modelName)) {
			return true, nil
		}
	}
	return false, nil
}

// PlanAllowedModel is the JSON shape stored in SubscriptionPlan.AllowedModels.
type PlanAllowedModel struct {
	Model string  `json:"model"`
	Ratio float64 `json:"ratio"`
}

// ListUpgradeableAgentPlans returns plans with a strictly higher PlanLevel
// rank than the user's current active agent subscription. Plans without a
// recognized level are skipped on the way out.
func ListUpgradeableAgentPlans(userId int) ([]SubscriptionPlan, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	current, err := GetUserActiveAgentSubscription(userId)
	if err != nil {
		return nil, err
	}
	currentRank := 0
	if current != nil {
		currentRank = PlanLevelRank[current.PlanLevel]
	}
	var plans []SubscriptionPlan
	err = DB.Where("enabled = ? AND tag = ?", true, PlanTagAgent).
		Order("sort_order desc, id desc").
		Find(&plans).Error
	if err != nil {
		return nil, err
	}
	result := make([]SubscriptionPlan, 0, len(plans))
	for _, p := range plans {
		rank, ok := PlanLevelRank[p.PlanLevel]
		if !ok || rank <= 0 {
			continue
		}
		if rank <= currentRank {
			continue
		}
		result = append(result, p)
	}
	return result, nil
}
