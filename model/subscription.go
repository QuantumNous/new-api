package model

import (
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/samber/hot"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Subscription duration units
const (
	SubscriptionDurationYear   = "year"
	SubscriptionDurationMonth  = "month"
	SubscriptionDurationDay    = "day"
	SubscriptionDurationHour   = "hour"
	SubscriptionDurationCustom = "custom"
)

const (
	SubscriptionResetPolicySourceVersion           = "plan_version"
	SubscriptionResetPolicySourceLegacy            = "legacy"
	SubscriptionResetPolicySourceMigrationBaseline = "migration_baseline"
)

// Subscription quota reset period
const (
	SubscriptionResetNever   = "never"
	SubscriptionResetDaily   = "daily"
	SubscriptionResetWeekly  = "weekly"
	SubscriptionResetMonthly = "monthly"
	SubscriptionResetCustom  = "custom"
)

const (
	SubscriptionQuotaActionRestoreWindow = "restore_window"
	SubscriptionQuotaActionInitialize    = "initialize"
)

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
	TotalAmount       int64 `json:"total_amount" gorm:"type:bigint;not null;default:0"`
	WindowAmount      int64 `json:"window_amount" gorm:"type:bigint;not null;default:0"`
	QuotaModelVersion int   `json:"quota_model_version" gorm:"type:int;not null;default:0"`

	// Quota reset period for plan
	QuotaResetPeriod        string `json:"quota_reset_period" gorm:"type:varchar(16);default:'never'"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;default:0"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

// SubscriptionPlanVersion is an immutable purchase-time representation of a
// logical subscription plan. Terms are stored through the existing common JSON
// wrapper so new plan fields can be added without changing historical rows.
type SubscriptionPlanVersion struct {
	Id            int    `json:"id"`
	PlanId        int    `json:"plan_id" gorm:"index;uniqueIndex:idx_subscription_plan_version,priority:1"`
	Version       int    `json:"version" gorm:"uniqueIndex:idx_subscription_plan_version,priority:2"`
	TermsSnapshot string `json:"terms_snapshot" gorm:"type:text;not null"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint;not null"`
}

func (v *SubscriptionPlanVersion) BeforeCreate(tx *gorm.DB) error {
	if v == nil || v.PlanId <= 0 || v.Version <= 0 || v.TermsSnapshot == "" {
		return errors.New("invalid subscription plan version")
	}
	if v.CreatedAt == 0 {
		v.CreatedAt = common.GetTimestamp()
	}
	return nil
}

func (v *SubscriptionPlanVersion) BeforeUpdate(tx *gorm.DB) error {
	return errors.New("subscription plan versions are immutable")
}

func (v *SubscriptionPlanVersion) BeforeDelete(tx *gorm.DB) error {
	return errors.New("subscription plan versions are immutable")
}

func (v *SubscriptionPlanVersion) PlanTerms() (*SubscriptionPlan, error) {
	if v == nil || v.TermsSnapshot == "" {
		return nil, errors.New("subscription plan version terms are empty")
	}
	var plan SubscriptionPlan
	if err := common.Unmarshal([]byte(v.TermsSnapshot), &plan); err != nil {
		return nil, fmt.Errorf("decode subscription plan version terms: %w", err)
	}
	plan.Id = v.PlanId
	return &plan, nil
}

func CreateSubscriptionPlanVersionTx(tx *gorm.DB, plan *SubscriptionPlan) (*SubscriptionPlanVersion, error) {
	if tx == nil || plan == nil || plan.Id <= 0 {
		return nil, errors.New("invalid subscription plan version arguments")
	}
	var version *SubscriptionPlanVersion
	err := tx.Transaction(func(tx *gorm.DB) error {
		var authoritative SubscriptionPlan
		if err := lockForUpdate(tx).First(&authoritative, plan.Id).Error; err != nil {
			return err
		}
		var err error
		version, err = createSubscriptionPlanVersionLocked(tx, &authoritative)
		return err
	})
	return version, err
}

// The parent plan lock serializes version allocation, including an empty history.
func createSubscriptionPlanVersionLocked(tx *gorm.DB, plan *SubscriptionPlan) (*SubscriptionPlanVersion, error) {
	terms, err := common.Marshal(plan)
	if err != nil {
		return nil, fmt.Errorf("encode subscription plan version terms: %w", err)
	}
	var latest SubscriptionPlanVersion
	query := lockForUpdate(tx).Where("plan_id = ?", plan.Id).Order("version desc").Limit(1).Find(&latest)
	versionNumber := 1
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected > 0 {
		versionNumber = latest.Version + 1
	}
	version := &SubscriptionPlanVersion{
		PlanId:        plan.Id,
		Version:       versionNumber,
		TermsSnapshot: string(terms),
	}
	if err := tx.Create(version).Error; err != nil {
		return nil, err
	}
	return version, nil
}

func getSubscriptionPlanVersionByIdTx(tx *gorm.DB, id int) (*SubscriptionPlanVersion, error) {
	if id <= 0 {
		return nil, errors.New("invalid subscription plan version id")
	}
	if tx == nil {
		tx = DB
	}
	var version SubscriptionPlanVersion
	if err := tx.First(&version, id).Error; err != nil {
		return nil, err
	}
	return &version, nil
}

func GetSubscriptionPlanVersionById(id int) (*SubscriptionPlanVersion, error) {
	return getSubscriptionPlanVersionByIdTx(nil, id)
}

func GetOrCreateCurrentSubscriptionPlanVersionTx(tx *gorm.DB, plan *SubscriptionPlan) (*SubscriptionPlanVersion, error) {
	if tx == nil || plan == nil || plan.Id <= 0 {
		return nil, errors.New("invalid current subscription plan version arguments")
	}
	var result *SubscriptionPlanVersion
	err := tx.Transaction(func(tx *gorm.DB) error {
		var authoritative SubscriptionPlan
		if err := lockForUpdate(tx).First(&authoritative, plan.Id).Error; err != nil {
			return err
		}
		var version SubscriptionPlanVersion
		query := lockForUpdate(tx).Where("plan_id = ?", plan.Id).Order("version desc").Limit(1).Find(&version)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			terms, err := version.PlanTerms()
			if err != nil {
				return err
			}
			terms.NormalizeDefaults()
			authoritative.NormalizeDefaults()
			terms.CreatedAt, terms.UpdatedAt = 0, 0
			current := authoritative
			current.CreatedAt, current.UpdatedAt = 0, 0
			if reflect.DeepEqual(*terms, current) {
				result = &version
				return nil
			}
		}
		var err error
		result, err = createSubscriptionPlanVersionLocked(tx, &authoritative)
		return err
	})
	return result, err
}

func GetOrCreateCurrentSubscriptionPlanVersion(planId int, expectedVersion ...int) (*SubscriptionPlanVersion, error) {
	if planId <= 0 {
		return nil, errors.New("invalid subscription plan id")
	}
	var result *SubscriptionPlanVersion
	err := DB.Transaction(func(tx *gorm.DB) error {
		plan, err := getSubscriptionPlanByIdTx(tx, planId)
		if err != nil {
			return err
		}
		result, err = GetOrCreateCurrentSubscriptionPlanVersionTx(tx, plan)
		if err == nil && len(expectedVersion) > 0 && expectedVersion[0] != 0 && expectedVersion[0] != result.Id {
			return common.NewMessage("Subscription plan has changed. Refresh and confirm the current terms before paying")
		}
		return err
	})
	return result, err
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
	Id            int     `json:"id"`
	UserId        int     `json:"user_id" gorm:"index"`
	PlanId        int     `json:"plan_id" gorm:"index"`
	PlanVersionId int     `json:"plan_version_id" gorm:"index"`
	Money         float64 `json:"money"`

	TradeNo         string `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	Status          string `json:"status"`
	CreateTime      int64  `json:"create_time"`
	CompleteTime    int64  `json:"complete_time"`

	ProviderPayload   string `json:"provider_payload" gorm:"type:text"`
	PlanTermsSnapshot string `json:"plan_terms_snapshot" gorm:"type:text"`
}

func (o *SubscriptionOrder) CapturePlanTerms(plan *SubscriptionPlan) {
	if plan == nil {
		return
	}
	data, err := common.Marshal(plan)
	if err == nil {
		o.PlanTermsSnapshot = string(data)
	}
}

func (o *SubscriptionOrder) PlanTerms() (*SubscriptionPlan, error) {
	if o == nil || o.PlanTermsSnapshot == "" {
		return nil, nil
	}
	var plan SubscriptionPlan
	if err := common.Unmarshal([]byte(o.PlanTermsSnapshot), &plan); err != nil {
		return nil, fmt.Errorf("decode subscription plan terms snapshot: %w", err)
	}
	return &plan, nil
}

func (p *SubscriptionPlan) ValidateQuotaConfiguration() error {
	if p == nil || p.QuotaModelVersion == 0 {
		return nil
	}
	if NormalizeResetPeriod(p.QuotaResetPeriod) == SubscriptionResetNever || p.TotalAmount == 0 {
		return nil
	}
	if p.WindowAmount <= 0 {
		return common.NewMessage("Window quota must be greater than zero when quota reset is enabled")
	}
	if p.WindowAmount > p.TotalAmount {
		return common.NewMessage("Window quota cannot exceed total quota")
	}
	return nil
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
	Id            int    `json:"id"`
	UserId        int    `json:"user_id" gorm:"index;index:idx_user_sub_active,priority:1"`
	PlanId        int    `json:"plan_id" gorm:"index"`
	PlanVersionId int    `json:"plan_version_id" gorm:"index"`
	PlanTitle     string `json:"plan_title,omitempty" gorm:"-"`
	PlanVersion   int    `json:"plan_version,omitempty" gorm:"-"`

	AmountTotal              int64  `json:"amount_total" gorm:"type:bigint;not null;default:0"`
	AmountUsed               int64  `json:"amount_used" gorm:"type:bigint;not null;default:0"`
	WindowAmount             int64  `json:"window_amount" gorm:"type:bigint;not null;default:0"`
	QuotaModelVersion        int    `json:"quota_model_version" gorm:"type:int;not null;default:0"`
	QuotaResetPeriod         string `json:"quota_reset_period" gorm:"type:varchar(16);not null;default:''"`
	QuotaResetCustomSeconds  int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;not null;default:0"`
	LegacyResetPeriod        string `json:"-" gorm:"type:varchar(16);not null;default:''"`
	LegacyResetCustomSeconds int64  `json:"-" gorm:"type:bigint;not null;default:0"`
	ResetPolicySource        string `json:"reset_policy_source,omitempty" gorm:"type:varchar(32);not null;default:''"`
	LegacyResetBaselineAt    int64  `json:"legacy_reset_baseline_at,omitempty" gorm:"type:bigint;not null;default:0"`
	AmountReserved           int64  `json:"amount_reserved" gorm:"type:bigint;not null;default:0"`
	WindowAmountReserved     int64  `json:"window_amount_reserved,omitempty" gorm:"->;-:migration"`
	ResetGeneration          int64  `json:"reset_generation" gorm:"type:bigint;not null;default:0"`
	TotalAmountUsed          int64  `json:"total_amount_used" gorm:"type:bigint;not null;default:0"`
	WindowAmountUsed         int64  `json:"window_amount_used" gorm:"type:bigint;not null;default:0"`
	HistoricalAmountUsed     int64  `json:"historical_amount_used" gorm:"type:bigint;not null;default:0"`

	StartTime int64  `json:"start_time" gorm:"bigint"`
	EndTime   int64  `json:"end_time" gorm:"bigint;index;index:idx_user_sub_active,priority:3"`
	Status    string `json:"status" gorm:"type:varchar(32);index;index:idx_user_sub_active,priority:2"` // active/expired/cancelled

	Source string `json:"source" gorm:"type:varchar(32);default:'order'"` // order/admin

	LastResetTime int64 `json:"last_reset_time" gorm:"type:bigint;default:0"`
	NextResetTime int64 `json:"next_reset_time" gorm:"type:bigint;default:0;index"`

	UpgradeGroup  string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`
	PrevUserGroup string `json:"prev_user_group" gorm:"type:varchar(64);default:''"`

	// Downgrade target group on expiry (snapshot from plan; empty = revert to PrevUserGroup)
	DowngradeGroup string `json:"downgrade_group" gorm:"type:varchar(64);default:''"`

	// Whether wallet fallback is allowed after this subscription's quota is exhausted (snapshot from plan)
	AllowWalletOverflow bool `json:"allow_wallet_overflow"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

// SubscriptionQuotaOperation is the durable audit receipt for an administrator
// quota restoration. The idempotency key is unique so a retried request cannot
// grant quota a second time.
type SubscriptionQuotaOperation struct {
	IdempotencyKey     string `json:"idempotency_key" gorm:"primaryKey;type:varchar(128)"`
	UserId             int    `json:"user_id" gorm:"index"`
	UserSubscriptionId int    `json:"user_subscription_id" gorm:"index"`
	Action             string `json:"action" gorm:"type:varchar(32);not null"`
	AdminId            int    `json:"admin_id" gorm:"index"`
	Reason             string `json:"reason" gorm:"type:text;not null"`
	ReturnedQuota      int64  `json:"returned_quota" gorm:"type:bigint;not null;default:0"`
	TotalRemaining     int64  `json:"total_remaining" gorm:"type:bigint;not null;default:0"`
	WindowRemaining    int64  `json:"window_remaining" gorm:"type:bigint;not null;default:0"`
	Unlimited          bool   `json:"unlimited" gorm:"not null;default:false"`
	CreatedAt          int64  `json:"created_at" gorm:"bigint;not null"`
}

type SubscriptionQuotaRestoreResult struct {
	IdempotencyKey     string `json:"idempotency_key"`
	UserId             int    `json:"user_id"`
	UserSubscriptionId int    `json:"user_subscription_id"`
	Action             string `json:"action"`
	ReturnedQuota      int64  `json:"returned_quota"`
	TotalRemaining     int64  `json:"total_remaining"`
	WindowRemaining    int64  `json:"window_remaining"`
	Unlimited          bool   `json:"unlimited"`
	CreatedAt          int64  `json:"created_at"`
}

// SubscriptionPlanQuotaOperation freezes the result of a batch restoration so
// retries cannot grant another window or include subscriptions added later.
type SubscriptionPlanQuotaOperation struct {
	IdempotencyKey string `json:"idempotency_key" gorm:"primaryKey;type:varchar(128)"`
	Action         string `json:"action" gorm:"type:varchar(32);not null;default:restore_window"`
	PlanId         int    `json:"plan_id" gorm:"index;not null"`
	AdminId        int    `json:"-" gorm:"index;not null"`
	Reason         string `json:"-" gorm:"type:text;not null"`
	MatchedCount   int    `json:"matched_count" gorm:"not null"`
	ResetCount     int    `json:"reset_count" gorm:"not null"`
	UserCount      int    `json:"user_count" gorm:"not null"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint;not null"`
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

func calcRollingSubscriptionResetTime(anchor, after time.Time, plan *SubscriptionPlan, endUnix int64) int64 {
	if plan == nil {
		return 0
	}
	period := NormalizeResetPeriod(plan.QuotaResetPeriod)
	if period == SubscriptionResetNever {
		return 0
	}
	anchor = anchor.UTC()
	after = after.UTC()
	var next time.Time
	switch period {
	case SubscriptionResetDaily, SubscriptionResetWeekly, SubscriptionResetCustom:
		var interval time.Duration
		switch period {
		case SubscriptionResetDaily:
			interval = 24 * time.Hour
		case SubscriptionResetWeekly:
			interval = 7 * 24 * time.Hour
		default:
			if plan.QuotaResetCustomSeconds <= 0 || plan.QuotaResetCustomSeconds > int64((1<<63-1)/time.Second) {
				return 0
			}
			interval = time.Duration(plan.QuotaResetCustomSeconds) * time.Second
		}
		elapsed := after.Sub(anchor)
		intervals := int64(0)
		if elapsed >= 0 {
			intervals = int64(elapsed / interval)
		}
		next = anchor.Add(time.Duration(intervals+1) * interval)
	case SubscriptionResetMonthly:
		months := (after.Year()-anchor.Year())*12 + int(after.Month()-anchor.Month())
		boundary := func(monthOffset int) time.Time {
			monthStart := time.Date(anchor.Year(), anchor.Month()+time.Month(monthOffset), 1, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
			lastDay := monthStart.AddDate(0, 1, -1).Day()
			day := min(anchor.Day(), lastDay)
			return time.Date(monthStart.Year(), monthStart.Month(), day, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
		}
		if months < 0 {
			months = 0
		}
		if boundary(months).After(after) {
			months--
		}
		next = boundary(months + 1)
	default:
		return 0
	}
	if !next.After(after) || endUnix > 0 && next.Unix() >= endUnix {
		return 0
	}
	return next.Unix()
}

func rollingSubscriptionLastResetTime(anchor, now time.Time, plan *SubscriptionPlan) int64 {
	if plan == nil {
		return 0
	}
	anchor = anchor.UTC()
	now = now.UTC()
	period := NormalizeResetPeriod(plan.QuotaResetPeriod)
	switch period {
	case SubscriptionResetDaily, SubscriptionResetWeekly, SubscriptionResetCustom:
		interval := 24 * time.Hour
		if period == SubscriptionResetWeekly {
			interval = 7 * 24 * time.Hour
		} else if period == SubscriptionResetCustom {
			if plan.QuotaResetCustomSeconds <= 0 || plan.QuotaResetCustomSeconds > int64((1<<63-1)/time.Second) {
				return 0
			}
			interval = time.Duration(plan.QuotaResetCustomSeconds) * time.Second
		}
		elapsed := now.Sub(anchor)
		if elapsed < 0 {
			return anchor.Unix()
		}
		return anchor.Add(time.Duration(int64(elapsed/interval)) * interval).Unix()
	case SubscriptionResetMonthly:
		months := (now.Year()-anchor.Year())*12 + int(now.Month()-anchor.Month())
		boundary := func(monthOffset int) time.Time {
			monthStart := time.Date(anchor.Year(), anchor.Month()+time.Month(monthOffset), 1, anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
			lastDay := monthStart.AddDate(0, 1, -1).Day()
			return time.Date(monthStart.Year(), monthStart.Month(), min(anchor.Day(), lastDay), anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), time.UTC)
		}
		if months < 0 {
			return anchor.Unix()
		}
		if boundary(months).After(now) {
			months--
		}
		return boundary(max(months, 0)).Unix()
	default:
		return 0
	}
}

func GetSubscriptionPlanById(id int) (*SubscriptionPlan, error) {
	return getSubscriptionPlanByIdTx(nil, id)
}

func getSubscriptionPlanByIdTx(tx *gorm.DB, id int) (*SubscriptionPlan, error) {
	if id <= 0 {
		return nil, errors.New("invalid plan id")
	}
	key := subscriptionPlanCacheKey(id)
	if tx == nil && key != "" {
		if cached, found, err := getSubscriptionPlanCache().Get(key); err == nil && found {
			cached.NormalizeDefaults()
			return &cached, nil
		}
	}
	var plan SubscriptionPlan
	query := DB
	if tx != nil {
		query = lockForUpdate(tx)
	}
	if err := query.Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, err
	}
	plan.NormalizeDefaults()
	if tx == nil {
		_ = getSubscriptionPlanCache().SetWithTTL(key, plan, subscriptionPlanCacheTTL())
	}
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
	if err := lockForUpdate(tx).Model(&User{}).Where("id = ?", userId).Select(commonGroupCol).Find(&group).Error; err != nil {
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

func createUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, planVersionId int, source string) (*UserSubscription, error) {
	if tx == nil {
		return nil, errors.New("tx is nil")
	}
	if plan == nil || plan.Id == 0 {
		return nil, errors.New("invalid plan")
	}
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	if err := plan.ValidateQuotaConfiguration(); err != nil {
		return nil, err
	}
	if plan.MaxPurchasePerUser > 0 {
		var count int64
		if err := tx.Model(&UserSubscription{}).
			Where("user_id = ? AND plan_id = ?", userId, plan.Id).
			Count(&count).Error; err != nil {
			return nil, err
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			return nil, common.NewMessage("Purchase limit for this plan has been reached")
		}
	}
	nowUnix := getDBTimestampTx(tx)
	now := time.Unix(nowUnix, 0)
	endUnix, err := calcPlanEndTime(now, plan)
	if err != nil {
		return nil, err
	}
	resetBase := now
	nextReset := calcNextResetTime(resetBase, plan, endUnix)
	resetPeriodSnapshot := ""
	resetCustomSecondsSnapshot := int64(0)
	legacyResetPeriodSnapshot := ""
	legacyResetCustomSecondsSnapshot := int64(0)
	resetPolicySource := SubscriptionResetPolicySourceLegacy
	if plan.QuotaModelVersion > 0 {
		resetPolicySource = SubscriptionResetPolicySourceVersion
		resetPeriodSnapshot = NormalizeResetPeriod(plan.QuotaResetPeriod)
		resetCustomSecondsSnapshot = plan.QuotaResetCustomSeconds
		nextReset = calcRollingSubscriptionResetTime(resetBase, resetBase, plan, endUnix)
	} else {
		legacyResetPeriodSnapshot = NormalizeResetPeriod(plan.QuotaResetPeriod)
		legacyResetCustomSecondsSnapshot = plan.QuotaResetCustomSeconds
	}
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
		UserId:                   userId,
		PlanId:                   plan.Id,
		PlanVersionId:            planVersionId,
		AmountTotal:              plan.TotalAmount,
		AmountUsed:               0,
		WindowAmount:             plan.WindowAmount,
		QuotaModelVersion:        plan.QuotaModelVersion,
		QuotaResetPeriod:         resetPeriodSnapshot,
		QuotaResetCustomSeconds:  resetCustomSecondsSnapshot,
		LegacyResetPeriod:        legacyResetPeriodSnapshot,
		LegacyResetCustomSeconds: legacyResetCustomSecondsSnapshot,
		ResetPolicySource:        resetPolicySource,
		StartTime:                now.Unix(),
		EndTime:                  endUnix,
		Status:                   "active",
		Source:                   source,
		LastResetTime:            lastReset,
		NextResetTime:            nextReset,
		UpgradeGroup:             upgradeGroup,
		PrevUserGroup:            prevGroup,
		DowngradeGroup:           strings.TrimSpace(plan.DowngradeGroup),
		AllowWalletOverflow:      allowWalletOverflow,
		CreatedAt:                common.GetTimestamp(),
		UpdatedAt:                common.GetTimestamp(),
	}
	if err := tx.Create(sub).Error; err != nil {
		return nil, err
	}
	return sub, nil
}

func CreateUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string) (*UserSubscription, error) {
	return createUserSubscriptionFromPlanTx(tx, userId, plan, 0, source)
}

func CreateUserSubscriptionFromPlanVersionTx(tx *gorm.DB, userId int, version *SubscriptionPlanVersion, source string) (*UserSubscription, error) {
	if version == nil {
		return nil, errors.New("subscription plan version is nil")
	}
	plan, err := version.PlanTerms()
	if err != nil {
		return nil, err
	}
	return createUserSubscriptionFromPlanTx(tx, userId, plan, version.Id, source)
}

func refreshSubscriptionUserGroupCache(userId int, operation string) {
	if err := RefreshUserGroupCache(userId); err != nil {
		common.SysError(common.LogText("failed to refresh user group cache after %s for user %d: %v", operation, userId, err))
	}
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
		var err error
		var plan *SubscriptionPlan
		var planVersion *SubscriptionPlanVersion
		if order.PlanVersionId > 0 {
			planVersion, err = getSubscriptionPlanVersionByIdTx(tx, order.PlanVersionId)
			if err != nil {
				return err
			}
			if planVersion.PlanId != order.PlanId {
				return errors.New("subscription order plan version mismatch")
			}
			plan, err = planVersion.PlanTerms()
		} else {
			plan, err = order.PlanTerms()
			if err == nil && plan == nil {
				plan, err = getSubscriptionPlanByIdTx(tx, order.PlanId)
			}
		}
		if err != nil {
			return err
		}
		if !plan.Enabled {
			// still allow completion for already purchased orders
		}
		// 锁定用户行：并发完成同一用户的不同订单（包括多实例部署下）时，
		// 使 CreateUserSubscriptionFromPlanTx 的 MaxPurchasePerUser 检查按用户串行。
		var userRow User
		if err := lockForUpdate(tx).Select("id").Where("id = ?", order.UserId).First(&userRow).Error; err != nil {
			return err
		}
		var subscription *UserSubscription
		if planVersion != nil {
			subscription, err = CreateUserSubscriptionFromPlanVersionTx(tx, order.UserId, planVersion, "order")
		} else {
			subscription, err = CreateUserSubscriptionFromPlanTx(tx, order.UserId, plan, "order")
		}
		if err != nil {
			return err
		}
		if subscription.PrevUserGroup != "" {
			upgradeGroup = strings.TrimSpace(subscription.UpgradeGroup)
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
		refreshSubscriptionUserGroupCache(logUserId, common.LogText("subscription payment completion"))
	}
	if logUserId > 0 {
		RecordLog(logUserId, LogTypeTopup, common.NewMessage("Subscription purchased, plan: {{plan}}, payment amount: {{amount}}, payment method: {{method}}", map[string]any{
			"plan":   logPlanTitle,
			"amount": fmt.Sprintf("%.2f", logMoney),
			"method": logPaymentMethod,
		}))
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
func AdminBindSubscription(userId int, planId int, sourceNote string) (*common.Message, error) {
	if userId <= 0 || planId <= 0 {
		return nil, errors.New("invalid userId or planId")
	}
	planVersion, err := GetOrCreateCurrentSubscriptionPlanVersion(planId)
	if err != nil {
		return nil, err
	}
	versionPlan, err := planVersion.PlanTerms()
	if err != nil {
		return nil, err
	}
	groupChanged := false
	err = DB.Transaction(func(tx *gorm.DB) error {
		// 与 CompleteSubscriptionOrder 一致：先锁用户行，再做购买次数检查。
		var userRow User
		if err := lockForUpdate(tx).Select("id").Where("id = ?", userId).First(&userRow).Error; err != nil {
			return err
		}
		subscription, err := CreateUserSubscriptionFromPlanVersionTx(tx, userId, planVersion, "admin")
		if err == nil {
			groupChanged = subscription.PrevUserGroup != ""
		}
		return err
	})
	if err != nil {
		return nil, err
	}
	if groupChanged {
		refreshSubscriptionUserGroupCache(userId, common.LogText("admin subscription creation"))
		return common.NewMessage("User group will be upgraded to {{group}}", map[string]any{"group": versionPlan.UpgradeGroup}), nil
	}
	return nil, nil
}

func calcSubscriptionBalanceQuota(priceAmount float64) (int, error) {
	if priceAmount <= 0 {
		return 0, nil
	}
	if common.QuotaPerUnit <= 0 {
		return 0, common.NewMessage("Quota unit is misconfigured")
	}
	quota := decimal.NewFromFloat(priceAmount).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Ceil()
	return common.WalletQuotaFromDecimalStrict(quota)
}

// PurchaseSubscriptionWithBalance creates a subscription by deducting the user's wallet quota.
func PurchaseSubscriptionWithBalance(userId int, planId int, expectedVersion ...int) error {
	if userId <= 0 || planId <= 0 {
		return errors.New("invalid userId or planId")
	}

	var logPlanTitle string
	var logMoney float64
	var chargedQuota int
	var upgradeGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		plan, err := getSubscriptionPlanByIdTx(tx, planId)
		if err != nil {
			return err
		}
		if !plan.Enabled {
			return common.NewMessage("Subscription plan is not enabled")
		}
		if plan.PriceAmount < 0 {
			return common.NewMessage("Price cannot be negative")
		}
		if plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
			return common.NewMessage("This plan does not allow balance redemption")
		}
		planVersion, err := GetOrCreateCurrentSubscriptionPlanVersionTx(tx, plan)
		if err != nil {
			return err
		}
		if len(expectedVersion) > 0 && expectedVersion[0] != 0 && expectedVersion[0] != planVersion.Id {
			return common.NewMessage("Subscription plan has changed. Refresh and confirm the current terms before paying")
		}
		versionPlan, err := planVersion.PlanTerms()
		if err != nil {
			return err
		}

		requiredQuota, err := calcSubscriptionBalanceQuota(versionPlan.PriceAmount)
		if err != nil {
			return err
		}

		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if requiredQuota > 0 && user.Quota < requiredQuota {
			return common.NewMessage("Insufficient balance")
		}
		if requiredQuota > 0 {
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota - ?", requiredQuota)).Error; err != nil {
				return err
			}
		}

		subscription, err := CreateUserSubscriptionFromPlanVersionTx(tx, userId, planVersion, PaymentMethodBalance)
		if err != nil {
			return err
		}

		now := common.GetTimestamp()
		tradeNo := fmt.Sprintf("SUBBALUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().UnixNano())
		order := &SubscriptionOrder{
			UserId:          userId,
			PlanId:          plan.Id,
			PlanVersionId:   planVersion.Id,
			Money:           versionPlan.PriceAmount,
			TradeNo:         tradeNo,
			PaymentMethod:   PaymentMethodBalance,
			PaymentProvider: PaymentProviderBalance,
			Status:          common.TopUpStatusSuccess,
			CreateTime:      now,
			CompleteTime:    now,
			ProviderPayload: fmt.Sprintf("charged_quota=%d", requiredQuota),
		}
		order.CapturePlanTerms(versionPlan)
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		logPlanTitle = versionPlan.Title
		logMoney = versionPlan.PriceAmount
		chargedQuota = requiredQuota
		if subscription.PrevUserGroup != "" {
			upgradeGroup = strings.TrimSpace(subscription.UpgradeGroup)
		}
		return nil
	})
	if err != nil {
		return err
	}

	if chargedQuota > 0 {
		if err := cacheDecrUserQuota(userId, int64(chargedQuota)); err != nil {
			common.SysLog(common.LogText("failed to decrease user quota cache after subscription balance purchase: %s", err.Error()))
		}
	}
	if upgradeGroup != "" {
		refreshSubscriptionUserGroupCache(userId, common.LogText("subscription balance purchase"))
	}
	RecordLog(userId, LogTypeTopup, common.NewMessage("Subscription purchased with balance, plan: {{plan}}, payment amount: {{amount}}, quota deducted: {{quota}}", map[string]any{
		"plan":   logPlanTitle,
		"amount": fmt.Sprintf("%.2f", logMoney),
		"quota":  chargedQuota,
	}))
	return nil
}

// GetAllActiveUserSubscriptions returns all active subscriptions for a user.
func GetAllActiveUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	now := common.GetTimestamp()
	var subs []UserSubscription
	err := subscriptionUsageQuery(DB).Where("user_id = ? AND status = ? AND end_time > ?", userId, "active", now).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return buildSubscriptionSummaries(DB, subs)
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
	err := subscriptionUsageQuery(DB).Where("user_id = ?", userId).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return buildSubscriptionSummaries(DB, subs)
}

// subscriptionUsageQuery reads counters and current-window reservations in one
// database snapshot, including on PostgreSQL at READ COMMITTED isolation.
func subscriptionUsageQuery(db *gorm.DB) *gorm.DB {
	reserved := db.Session(&gorm.Session{NewDB: true}).Model(&SubscriptionPreConsumeRecord{}).
		Select("COALESCE(SUM(pre_consumed), 0)").
		Where("user_subscription_id = subscription_usage.id AND reset_generation = subscription_usage.reset_generation AND status = ?", "reserved")
	return db.Model(&UserSubscription{}).
		Table("? AS subscription_usage", clause.Table{Name: db.NamingStrategy.TableName("UserSubscription")}).
		Select("subscription_usage.*, (?) AS window_amount_reserved", reserved)
}

func buildSubscriptionSummaries(db *gorm.DB, subs []UserSubscription) ([]SubscriptionSummary, error) {
	if len(subs) == 0 {
		return []SubscriptionSummary{}, nil
	}

	result := make([]SubscriptionSummary, 0, len(subs))
	for _, sub := range subs {
		subCopy := sub
		if subCopy.PlanVersionId > 0 {
			version, err := getSubscriptionPlanVersionByIdTx(db, subCopy.PlanVersionId)
			if err != nil {
				return nil, err
			}
			versionPlan, err := version.PlanTerms()
			if err != nil {
				return nil, err
			}
			subCopy.PlanTitle = versionPlan.Title
			subCopy.PlanVersion = version.Version
		} else if plan, err := getSubscriptionPlanByIdTx(db, subCopy.PlanId); err == nil {
			subCopy.PlanTitle = plan.Title
		}
		result = append(result, SubscriptionSummary{
			Subscription: &subCopy,
		})
	}
	return result, nil
}

// AdminInvalidateUserSubscription marks a user subscription as cancelled and ends it immediately.
func AdminInvalidateUserSubscription(userSubscriptionId int) (*common.Message, error) {
	if userSubscriptionId <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
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
		if err := tx.Model(&sub).Updates(map[string]any{
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
		return nil, err
	}
	if cacheGroup != "" && userId > 0 {
		refreshSubscriptionUserGroupCache(userId, common.LogText("admin subscription update"))
	}
	if downgradeGroup != "" {
		return common.NewMessage("User group will be reverted to {{group}}", map[string]any{"group": downgradeGroup}), nil
	}
	return nil, nil
}

// AdminDeleteUserSubscription hard-deletes a user subscription.
func AdminDeleteUserSubscription(userSubscriptionId int) (*common.Message, error) {
	if userSubscriptionId <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
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
		return nil, err
	}
	if cacheGroup != "" && userId > 0 {
		refreshSubscriptionUserGroupCache(userId, common.LogText("admin subscription deletion"))
	}
	if downgradeGroup != "" {
		return common.NewMessage("User group will be reverted to {{group}}", map[string]any{"group": downgradeGroup}), nil
	}
	return nil, nil
}

func resetUserSubscriptionTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan, now int64, advanceResetTime bool) error {
	if tx == nil || sub == nil || plan == nil {
		return errors.New("invalid reset args")
	}
	if sub.QuotaModelVersion > 0 {
		sub.AmountUsed = sub.TotalAmountUsed
	} else {
		sub.AmountUsed = 0
	}
	if advanceResetTime {
		resetPlan := plan
		if sub.QuotaModelVersion == 0 && sub.LegacyResetPeriod != "" {
			resetPlan = &SubscriptionPlan{QuotaResetPeriod: sub.LegacyResetPeriod, QuotaResetCustomSeconds: sub.LegacyResetCustomSeconds}
		}
		nextReset := calcNextResetTime(time.Unix(now, 0), resetPlan, sub.EndTime)
		if sub.QuotaModelVersion > 0 {
			nextReset = calcRollingSubscriptionResetTime(time.Unix(now, 0), time.Unix(now, 0), &SubscriptionPlan{
				QuotaResetPeriod:        sub.QuotaResetPeriod,
				QuotaResetCustomSeconds: sub.QuotaResetCustomSeconds,
			}, sub.EndTime)
			sub.ResetGeneration++
		}
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
	if err := lockForUpdate(tx).
		Where("user_id = ? AND plan_id = ? AND status = ? AND end_time > ?", userId, plan.Id, "active", now).
		Order("end_time asc, id asc").
		Find(&subs).Error; err != nil {
		return nil, err
	}
	if len(subs) == 0 {
		return nil, common.NewMessage("This user has no active subscription to this plan")
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
	if err := lockForUpdate(tx).
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

func AdminRestoreUserSubscriptionQuota(userId, subscriptionId int, action, idempotencyKey string, adminId int, reason string) (*SubscriptionQuotaRestoreResult, error) {
	return adminRestoreUserSubscriptionQuota(DB, GetDBTimestamp(), userId, subscriptionId, action, idempotencyKey, adminId, reason)
}

func adminRestoreUserSubscriptionQuota(db *gorm.DB, now int64, userId, subscriptionId int, action, idempotencyKey string, adminId int, reason string) (*SubscriptionQuotaRestoreResult, error) {
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	reason = strings.TrimSpace(reason)
	if userId <= 0 || subscriptionId <= 0 || adminId <= 0 {
		return nil, errors.New("invalid subscription quota restoration identity")
	}
	if len(idempotencyKey) == 0 || len(idempotencyKey) > 128 || reason == "" || len(reason) > 2000 {
		return nil, errors.New("invalid subscription quota restoration request")
	}
	if action != SubscriptionQuotaActionRestoreWindow && action != SubscriptionQuotaActionInitialize {
		return nil, errors.New("invalid subscription quota restoration action")
	}

	var result *SubscriptionQuotaRestoreResult
	err := db.Transaction(func(tx *gorm.DB) error {
		var operation SubscriptionQuotaOperation
		lookup := tx.Where("idempotency_key = ?", idempotencyKey).First(&operation)
		if lookup.Error == nil {
			if operation.UserId != userId || operation.UserSubscriptionId != subscriptionId || operation.Action != action || operation.AdminId != adminId || operation.Reason != reason {
				return errors.New("subscription quota restoration idempotency key conflicts with another request")
			}
			result = subscriptionQuotaRestoreResult(&operation)
			return nil
		}
		if !errors.Is(lookup.Error, gorm.ErrRecordNotFound) {
			return lookup.Error
		}

		var sub UserSubscription
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", subscriptionId, userId).First(&sub).Error; err != nil {
			return err
		}
		// A concurrent retry may have committed while this request waited on the
		// subscription row lock. Re-read its receipt before applying the mutation.
		lookup = tx.Where("idempotency_key = ?", idempotencyKey).First(&operation)
		if lookup.Error == nil {
			if operation.UserId != userId || operation.UserSubscriptionId != subscriptionId || operation.Action != action || operation.AdminId != adminId || operation.Reason != reason {
				return errors.New("subscription quota restoration idempotency key conflicts with another request")
			}
			result = subscriptionQuotaRestoreResult(&operation)
			return nil
		}
		if !errors.Is(lookup.Error, gorm.ErrRecordNotFound) {
			return lookup.Error
		}
		if sub.Status != "active" || sub.EndTime <= now {
			return errors.New("subscription quota can only be restored for an active subscription")
		}
		if sub.TotalAmountUsed < 0 || sub.WindowAmountUsed < 0 || sub.AmountReserved < 0 || sub.AmountUsed < 0 {
			return errors.New("subscription quota accounting is invalid")
		}
		maxInt64 := int64(^uint64(0) >> 1)
		if sub.QuotaModelVersion > 0 && sub.TotalAmountUsed > maxInt64-sub.AmountReserved {
			return errors.New("subscription reservation accounting is invalid")
		}

		beforeUsed := sub.TotalAmountUsed
		inFlight := sub.AmountReserved
		if sub.QuotaModelVersion == 0 {
			if err := tx.Model(&SubscriptionPreConsumeRecord{}).
				Select("COALESCE(SUM(pre_consumed), 0)").
				Where("user_subscription_id = ? AND status = ? AND reset_generation = ?", sub.Id, "consumed", sub.ResetGeneration).
				Scan(&inFlight).Error; err != nil {
				return err
			}
			if inFlight < 0 || inFlight > sub.AmountUsed {
				return errors.New("subscription reservation accounting is invalid")
			}
			beforeUsed = sub.AmountUsed - inFlight
		}
		legacyResetPeriod := sub.LegacyResetPeriod
		if legacyResetPeriod == "" {
			legacyResetPeriod = sub.QuotaResetPeriod
		}
		legacyResetEnabled := NormalizeResetPeriod(legacyResetPeriod) != SubscriptionResetNever
		legacyHasWindow := sub.QuotaModelVersion == 0 && legacyResetEnabled
		afterUsed := beforeUsed
		switch action {
		case SubscriptionQuotaActionRestoreWindow:
			if sub.AmountTotal > 0 {
				windowAmount := sub.WindowAmount
				if legacyHasWindow {
					windowAmount = sub.AmountTotal
				}
				afterUsed = max(beforeUsed-max(windowAmount, 0), 0)
			}
		case SubscriptionQuotaActionInitialize:
			afterUsed = 0
		}
		if sub.AmountTotal > 0 && afterUsed+inFlight > sub.AmountTotal {
			return errors.New("subscription total use exceeds original quota")
		}
		if sub.QuotaModelVersion > 0 {
			sub.TotalAmountUsed = afterUsed
			sub.AmountUsed = afterUsed
		} else {
			sub.AmountUsed = afterUsed + inFlight
		}
		sub.WindowAmountUsed = 0
		if sub.QuotaModelVersion > 0 {
			sub.ResetGeneration++
		}

		var windowReserved int64
		if sub.AmountTotal > 0 && NormalizeResetPeriod(sub.QuotaResetPeriod) != SubscriptionResetNever {
			if err := tx.Model(&SubscriptionPreConsumeRecord{}).
				Select("COALESCE(SUM(pre_consumed), 0)").
				Where("user_subscription_id = ? AND status = ? AND reset_generation = ?", sub.Id, "reserved", sub.ResetGeneration).
				Scan(&windowReserved).Error; err != nil {
				return err
			}
		}
		if err := tx.Save(&sub).Error; err != nil {
			return err
		}

		returned := int64(0)
		if sub.AmountTotal > 0 {
			returned = beforeUsed - afterUsed
		}
		totalRemaining := int64(0)
		if sub.AmountTotal > 0 {
			usedForTotal := sub.AmountUsed
			if sub.QuotaModelVersion > 0 {
				usedForTotal = sub.TotalAmountUsed + sub.AmountReserved
			}
			totalRemaining = max(sub.AmountTotal-usedForTotal, 0)
		}
		windowRemaining := int64(0)
		if sub.QuotaModelVersion > 0 && sub.AmountTotal > 0 && NormalizeResetPeriod(sub.QuotaResetPeriod) != SubscriptionResetNever {
			windowRemaining = max(sub.WindowAmount-sub.WindowAmountUsed-windowReserved, 0)
		} else if legacyHasWindow && sub.AmountTotal > 0 {
			windowRemaining = totalRemaining
		}
		operation = SubscriptionQuotaOperation{
			IdempotencyKey: idempotencyKey, UserId: userId, UserSubscriptionId: subscriptionId,
			Action: action, AdminId: adminId, Reason: reason, ReturnedQuota: returned,
			TotalRemaining: totalRemaining, WindowRemaining: windowRemaining,
			Unlimited: sub.AmountTotal == 0, CreatedAt: now,
		}
		if err := tx.Create(&operation).Error; err != nil {
			return err
		}
		result = subscriptionQuotaRestoreResult(&operation)
		return nil
	})
	if err != nil {
		// Concurrent requests can both observe a missing receipt under snapshot
		// isolation. The unique key still prevents a second grant; return the
		// committed receipt to the matching retry after the losing transaction.
		var operation SubscriptionQuotaOperation
		if lookupErr := db.Where("idempotency_key = ?", idempotencyKey).First(&operation).Error; lookupErr == nil {
			if operation.UserId == userId && operation.UserSubscriptionId == subscriptionId && operation.Action == action && operation.AdminId == adminId && operation.Reason == reason {
				return subscriptionQuotaRestoreResult(&operation), nil
			}
		}
		return nil, err
	}
	return result, nil
}

func AdminRestorePlanSubscriptionWindows(planId int, idempotencyKey string, adminId int, reason string) (*SubscriptionPlanQuotaOperation, error) {
	return AdminRestorePlanSubscriptionQuota(planId, SubscriptionQuotaActionRestoreWindow, idempotencyKey, adminId, reason)
}

func AdminRestorePlanSubscriptionQuota(planId int, action, idempotencyKey string, adminId int, reason string) (*SubscriptionPlanQuotaOperation, error) {
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	reason = strings.TrimSpace(reason)
	if planId <= 0 || adminId <= 0 || len(idempotencyKey) == 0 || len(idempotencyKey) > 128 || reason == "" || len(reason) > 2000 || (action != SubscriptionQuotaActionRestoreWindow && action != SubscriptionQuotaActionInitialize) {
		return nil, common.NewMessage("Invalid parameters")
	}
	var result SubscriptionPlanQuotaOperation
	now := GetDBTimestamp()
	err := DB.Transaction(func(tx *gorm.DB) error {
		// Serialize batches for this plan before selecting the active subscriptions.
		var plan SubscriptionPlan
		if err := lockForUpdate(tx).First(&plan, planId).Error; err != nil {
			return err
		}
		lookup := lockForUpdate(tx).Where("idempotency_key = ?", idempotencyKey).First(&result)
		if lookup.Error == nil {
			if result.PlanId != planId || result.Action != action || result.AdminId != adminId || result.Reason != reason {
				return common.NewMessage("Idempotency key conflicts with another request")
			}
			return nil
		}
		if !errors.Is(lookup.Error, gorm.ErrRecordNotFound) {
			return lookup.Error
		}
		var subs []UserSubscription
		if err := lockForUpdate(tx).
			Where("plan_id = ? AND status = ? AND end_time > ?", planId, "active", now).
			Order("id asc").Find(&subs).Error; err != nil {
			return err
		}
		result = SubscriptionPlanQuotaOperation{
			IdempotencyKey: idempotencyKey, Action: action, PlanId: planId, AdminId: adminId,
			Reason: reason, MatchedCount: len(subs), CreatedAt: now,
		}
		userIds := make(map[int]struct{})
		batchKey := sha256.Sum256([]byte(idempotencyKey))
		for i := range subs {
			sub := &subs[i]
			period := sub.QuotaResetPeriod
			if sub.QuotaModelVersion == 0 && sub.LegacyResetPeriod != "" {
				period = sub.LegacyResetPeriod
			}
			if action == SubscriptionQuotaActionRestoreWindow && (sub.AmountTotal == 0 || NormalizeResetPeriod(period) == SubscriptionResetNever) {
				continue
			}
			key := fmt.Sprintf("plan-window:%x:%d", batchKey, sub.Id)
			if action == SubscriptionQuotaActionInitialize {
				key = fmt.Sprintf("plan-initialize:%x:%d", batchKey, sub.Id)
			}
			// Nested GORM transactions use savepoints; all per-subscription receipts
			// and quota updates still commit or roll back with the batch.
			if _, err := adminRestoreUserSubscriptionQuota(tx, now, sub.UserId, sub.Id, action, key, adminId, reason); err != nil {
				return err
			}
			result.ResetCount++
			userIds[sub.UserId] = struct{}{}
		}
		result.UserCount = len(userIds)
		return tx.Create(&result).Error
	})
	if err != nil {
		var committed SubscriptionPlanQuotaOperation
		if lookupErr := DB.Where("idempotency_key = ?", idempotencyKey).First(&committed).Error; lookupErr == nil && committed.PlanId == planId && committed.Action == action && committed.AdminId == adminId && committed.Reason == reason {
			return &committed, nil
		}
		return nil, err
	}
	return &result, nil
}

func subscriptionQuotaRestoreResult(operation *SubscriptionQuotaOperation) *SubscriptionQuotaRestoreResult {
	return &SubscriptionQuotaRestoreResult{
		IdempotencyKey: operation.IdempotencyKey, UserId: operation.UserId,
		UserSubscriptionId: operation.UserSubscriptionId, Action: operation.Action,
		ReturnedQuota: operation.ReturnedQuota, TotalRemaining: operation.TotalRemaining,
		WindowRemaining: operation.WindowRemaining, Unlimited: operation.Unlimited,
		CreatedAt: operation.CreatedAt,
	}
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
				Updates(map[string]any{
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
			refreshSubscriptionUserGroupCache(userId, common.LogText("subscription expiration"))
		}
	}
	return expiredCount, nil
}

// SubscriptionPreConsumeRecord stores idempotent pre-consume operations per request.
type SubscriptionPreConsumeRecord struct {
	Id                  int    `json:"id"`
	RequestId           string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId              int    `json:"user_id" gorm:"index"`
	UserSubscriptionId  int    `json:"user_subscription_id" gorm:"index"`
	PlanVersionId       int    `json:"plan_version_id" gorm:"index"`
	PreConsumed         int64  `json:"pre_consumed" gorm:"type:bigint;not null;default:0"`
	ResetGeneration     int64  `json:"reset_generation" gorm:"type:bigint;not null;default:0"`
	SettledAmount       int64  `json:"settled_amount" gorm:"type:bigint;not null;default:0"`
	SettlementAmount    int64  `json:"settlement_amount" gorm:"type:bigint;not null;default:0"`
	WalletSettledAmount int64  `json:"wallet_settled_amount" gorm:"type:bigint;not null;default:0"`
	WalletAuthorized    bool   `json:"wallet_authorized" gorm:"not null;default:false"`
	Status              string `json:"status" gorm:"type:varchar(32);index"` // reserved/consumed/settled/refunded
	CreatedAt           int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt           int64  `json:"updated_at" gorm:"bigint;index"`
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
	resetPlan := plan
	if sub.QuotaResetPeriod != "" {
		resetPlan = &SubscriptionPlan{QuotaResetPeriod: sub.QuotaResetPeriod, QuotaResetCustomSeconds: sub.QuotaResetCustomSeconds}
	} else if sub.LegacyResetPeriod != "" {
		resetPlan = &SubscriptionPlan{QuotaResetPeriod: sub.LegacyResetPeriod, QuotaResetCustomSeconds: sub.LegacyResetCustomSeconds}
	}
	if sub.NextResetTime > 0 && sub.NextResetTime > now {
		return nil
	}
	if NormalizeResetPeriod(resetPlan.QuotaResetPeriod) == SubscriptionResetNever {
		return nil
	}
	if sub.QuotaResetPeriod != "" {
		anchor := time.Unix(sub.StartTime, 0).UTC()
		nowTime := time.Unix(now, 0).UTC()
		next := calcRollingSubscriptionResetTime(anchor, nowTime, resetPlan, sub.EndTime)
		last := rollingSubscriptionLastResetTime(anchor, nowTime, resetPlan)
		if last > sub.LastResetTime {
			sub.WindowAmountUsed = 0
			sub.ResetGeneration++
		}
		sub.LastResetTime = last
		sub.NextResetTime = next
		return tx.Save(sub).Error
	}
	baseUnix := sub.LastResetTime
	if baseUnix <= 0 {
		baseUnix = sub.StartTime
	}
	base := time.Unix(baseUnix, 0)
	next := calcNextResetTime(base, resetPlan, sub.EndTime)
	advanced := false
	for next > 0 && next <= now {
		advanced = true
		base = time.Unix(next, 0)
		next = calcNextResetTime(base, resetPlan, sub.EndTime)
	}
	if !advanced {
		if sub.NextResetTime == 0 && next > 0 {
			sub.NextResetTime = next
			sub.LastResetTime = base.Unix()
			return tx.Save(sub).Error
		}
		if sub.NextResetTime > 0 && sub.NextResetTime <= now {
			// A migration can replace an inferred legacy period with a labeled
			// baseline after the persisted schedule has already passed. Advance
			// the schedule without resetting usage until the baseline period is
			// actually complete.
			sub.LastResetTime = base.Unix()
			sub.NextResetTime = next
			return tx.Save(sub).Error
		}
		return nil
	}
	sub.AmountUsed = 0
	sub.LastResetTime = base.Unix()
	sub.NextResetTime = next
	sub.ResetGeneration++
	return tx.Save(sub).Error
}

func snapshotLegacySubscriptionResetPolicies(db *gorm.DB) error {
	if db == nil {
		return errors.New("db is nil")
	}
	type legacyResetPolicy struct {
		Id                      int
		EndTime                 int64
		LegacyResetPeriod       string
		LegacyCustomSeconds     int64
		QuotaResetPeriod        string
		QuotaResetCustomSeconds int64
	}
	subscriptionsTable := db.NamingStrategy.TableName("UserSubscription")
	plansTable := db.NamingStrategy.TableName("SubscriptionPlan")
	var lastId int
	for {
		var policies []legacyResetPolicy
		err := db.Table(subscriptionsTable+" AS subscriptions").
			Select("subscriptions.id, subscriptions.end_time, subscriptions.legacy_reset_period, subscriptions.legacy_reset_custom_seconds AS legacy_custom_seconds, plans.quota_reset_period, plans.quota_reset_custom_seconds").
			Joins("LEFT JOIN "+plansTable+" AS plans ON plans.id = subscriptions.plan_id").
			Where("subscriptions.id > ? AND subscriptions.quota_model_version = 0 AND subscriptions.reset_policy_source = ''", lastId).
			Order("subscriptions.id asc").
			Limit(500).
			Find(&policies).Error
		if err != nil {
			return err
		}
		if len(policies) == 0 {
			return nil
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			migrationTime := common.GetTimestamp()
			for _, policy := range policies {
				period := NormalizeResetPeriod(policy.LegacyResetPeriod)
				customSeconds := policy.LegacyCustomSeconds
				updates := map[string]any{
					"reset_policy_source":      SubscriptionResetPolicySourceMigrationBaseline,
					"legacy_reset_baseline_at": migrationTime,
				}
				if policy.LegacyResetPeriod == "" {
					period = NormalizeResetPeriod(policy.QuotaResetPeriod)
					customSeconds = policy.QuotaResetCustomSeconds
					updates["legacy_reset_period"] = period
					updates["legacy_reset_custom_seconds"] = customSeconds
					resetBase := time.Unix(migrationTime, 0)
					nextReset := calcNextResetTime(resetBase, &SubscriptionPlan{
						QuotaResetPeriod:        period,
						QuotaResetCustomSeconds: customSeconds,
					}, policy.EndTime)
					updates["last_reset_time"] = migrationTime
					updates["next_reset_time"] = nextReset
					if NormalizeResetPeriod(period) == SubscriptionResetNever || nextReset == 0 {
						updates["last_reset_time"] = 0
					}
				}
				if err := tx.Model(&UserSubscription{}).Where("id = ? AND quota_model_version = 0 AND reset_policy_source = ''", policy.Id).
					Updates(updates).Error; err != nil {
					return err
				}
			}
			return nil
		}); err != nil {
			return err
		}
		lastId = policies[len(policies)-1].Id
	}
}

// PreConsumeUserSubscription pre-consumes from any active subscription total quota.
func PreConsumeUserSubscription(requestId string, userId int, modelName string, quotaType int, amount int64, billingPreference ...string) (*SubscriptionPreConsumeResult, error) {
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

	txOptions := &sql.TxOptions{Isolation: sql.LevelReadCommitted}
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		txOptions = nil
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing SubscriptionPreConsumeRecord
		query := tx.Where("request_id = ?", requestId).Limit(1).Find(&existing)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			if existing.UserId != userId {
				return errors.New("subscription pre-consume request belongs to another user")
			}
			if existing.Status == "refunded" {
				return errors.New("subscription pre-consume already refunded")
			}
			if existing.Status == "settled" {
				return errors.New("subscription pre-consume already settled")
			}
			if existing.Status != "reserved" && existing.Status != "consumed" {
				return errors.New("subscription pre-consume is not active")
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
			if sub.QuotaModelVersion > 0 {
				returnValue.AmountUsedBefore = sub.TotalAmountUsed
				returnValue.AmountUsedAfter = sub.TotalAmountUsed + sub.AmountReserved
			}
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
			resetGeneration := sub.ResetGeneration
			newQuotaModel := sub.QuotaModelVersion > 0
			if newQuotaModel {
				maxInt64 := int64(^uint64(0) >> 1)
				if sub.AmountReserved < 0 || sub.TotalAmountUsed < 0 || sub.TotalAmountUsed > maxInt64-sub.AmountReserved || amount > maxInt64-sub.TotalAmountUsed-sub.AmountReserved {
					return errors.New("subscription reservation exceeds supported quota")
				}
				usedBefore = sub.TotalAmountUsed + sub.AmountReserved
				if sub.AmountTotal > 0 && (sub.TotalAmountUsed > sub.AmountTotal || sub.AmountReserved > sub.AmountTotal-sub.TotalAmountUsed || amount > sub.AmountTotal-sub.TotalAmountUsed-sub.AmountReserved) {
					continue
				}
				if sub.AmountTotal > 0 && NormalizeResetPeriod(sub.QuotaResetPeriod) != SubscriptionResetNever {
					var windowReserved int64
					if err := tx.Model(&SubscriptionPreConsumeRecord{}).
						Select("COALESCE(SUM(pre_consumed), 0)").
						Where("user_subscription_id = ? AND status = ? AND reset_generation = ?", sub.Id, "reserved", resetGeneration).
						Scan(&windowReserved).Error; err != nil {
						return err
					}
					if sub.WindowAmountUsed > sub.WindowAmount || windowReserved > sub.WindowAmount-sub.WindowAmountUsed || amount > sub.WindowAmount-sub.WindowAmountUsed-windowReserved {
						continue
					}
				}
			} else if sub.AmountTotal > 0 && sub.AmountTotal-usedBefore < amount {
				continue
			}
			record := &SubscriptionPreConsumeRecord{
				RequestId:          requestId,
				UserId:             userId,
				UserSubscriptionId: sub.Id,
				PlanVersionId:      sub.PlanVersionId,
				PreConsumed:        amount,
				ResetGeneration:    resetGeneration,
				Status:             "consumed",
			}
			// Missing authorization (including requests from older nodes) must
			// never become permission to charge the wallet during task polling.
			if len(billingPreference) > 0 {
				pref := common.NormalizeBillingPreference(billingPreference[0])
				record.WalletAuthorized = newQuotaModel && sub.AllowWalletOverflow && (pref == "subscription_first" || pref == "wallet_first")
			}
			if newQuotaModel {
				record.Status = "reserved"
			}
			insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(record)
			if insert.Error != nil {
				return insert.Error
			}
			if insert.RowsAffected == 0 {
				var dup SubscriptionPreConsumeRecord
				if err := tx.Where("request_id = ?", requestId).First(&dup).Error; err != nil {
					return err
				}
				if dup.UserId != userId || dup.UserSubscriptionId != sub.Id {
					return errors.New("subscription pre-consume request conflicts with another reservation")
				}
				if dup.Status == "refunded" {
					return errors.New("subscription pre-consume already refunded")
				}
				if dup.Status == "settled" {
					return errors.New("subscription pre-consume already settled")
				}
				if dup.Status != "reserved" && dup.Status != "consumed" {
					return errors.New("subscription pre-consume is not active")
				}
				returnValue.UserSubscriptionId = sub.Id
				returnValue.PreConsumed = dup.PreConsumed
				returnValue.AmountTotal = sub.AmountTotal
				returnValue.AmountUsedBefore = sub.AmountUsed
				returnValue.AmountUsedAfter = sub.AmountUsed
				if newQuotaModel {
					returnValue.AmountUsedBefore = sub.TotalAmountUsed
					returnValue.AmountUsedAfter = sub.TotalAmountUsed + sub.AmountReserved
				}
				return nil
			}
			if newQuotaModel {
				sub.AmountReserved += amount
			} else {
				sub.AmountUsed += amount
			}
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
			returnValue.UserSubscriptionId = sub.Id
			returnValue.PreConsumed = amount
			returnValue.AmountTotal = sub.AmountTotal
			returnValue.AmountUsedBefore = usedBefore
			returnValue.AmountUsedAfter = sub.AmountUsed
			if newQuotaModel {
				returnValue.AmountUsedAfter = usedBefore + amount
			}
			return nil
		}
		return fmt.Errorf("subscription quota insufficient, need=%d", amount)
	}, txOptions)
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
		if record.Status == "refunded" || record.Status == "settled" {
			return nil
		}
		var sub UserSubscription
		if err := lockForUpdate(tx).
			Where("id = ?", record.UserSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		if sub.QuotaModelVersion > 0 {
			if sub.AmountReserved < record.PreConsumed {
				return errors.New("subscription reservation accounting is invalid")
			}
			sub.AmountReserved -= record.PreConsumed
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
			record.Status = "refunded"
			return tx.Save(&record).Error
		}
		if record.PreConsumed <= 0 {
			record.Status = "refunded"
			return tx.Save(&record).Error
		}
		if record.ResetGeneration != sub.ResetGeneration {
			record.Status = "refunded"
			return tx.Save(&record).Error
		}
		sub.AmountUsed = max(sub.AmountUsed-record.PreConsumed, 0)
		if err := tx.Save(&sub).Error; err != nil {
			return err
		}
		record.Status = "refunded"
		return tx.Save(&record).Error
	})
}

// AdjustUserSubscriptionReservation changes the amount held by an in-flight request.
func AdjustUserSubscriptionReservation(requestId string, delta int64) error {
	if strings.TrimSpace(requestId) == "" {
		return errors.New("requestId is empty")
	}
	if delta == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var record SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&record).Error; err != nil {
			return err
		}
		if record.Status != "reserved" && record.Status != "consumed" {
			return errors.New("subscription reservation is no longer active")
		}
		var sub UserSubscription
		if err := lockForUpdate(tx).Where("id = ?", record.UserSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		if sub.QuotaModelVersion == 0 {
			minInt64 := -int64(^uint64(0)>>1) - 1
			if delta == minInt64 || delta < 0 && record.PreConsumed < -delta {
				return errors.New("subscription reservation adjustment cannot be negative")
			}
			if record.ResetGeneration != sub.ResetGeneration && delta < 0 {
				record.PreConsumed += delta
				return tx.Save(&record).Error
			}
			nextUsed := sub.AmountUsed + delta
			if nextUsed < 0 || sub.AmountTotal > 0 && nextUsed > sub.AmountTotal {
				return errors.New("subscription used exceeds total")
			}
			sub.AmountUsed = nextUsed
			record.PreConsumed += delta
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
			return tx.Save(&record).Error
		}
		maxInt64 := int64(^uint64(0) >> 1)
		minInt64 := -maxInt64 - 1
		if sub.AmountReserved < 0 || sub.TotalAmountUsed < 0 || sub.TotalAmountUsed > maxInt64-sub.AmountReserved || record.PreConsumed < 0 || delta == minInt64 || delta < 0 && record.PreConsumed < -delta || delta > 0 && (delta > maxInt64-sub.TotalAmountUsed-sub.AmountReserved || delta > maxInt64-record.PreConsumed) || delta > 0 && (sub.AmountTotal > 0 && (sub.TotalAmountUsed > sub.AmountTotal || sub.AmountReserved > sub.AmountTotal-sub.TotalAmountUsed || delta > sub.AmountTotal-sub.TotalAmountUsed-sub.AmountReserved)) {
			return errors.New("subscription reservation exceeds available quota")
		}
		if delta > 0 && sub.AmountTotal > 0 && NormalizeResetPeriod(sub.QuotaResetPeriod) != SubscriptionResetNever && record.ResetGeneration == sub.ResetGeneration {
			var windowReserved int64
			if err := tx.Model(&SubscriptionPreConsumeRecord{}).
				Select("COALESCE(SUM(pre_consumed), 0)").
				Where("user_subscription_id = ? AND status = ? AND reset_generation = ?", sub.Id, "reserved", record.ResetGeneration).
				Scan(&windowReserved).Error; err != nil {
				return err
			}
			if sub.WindowAmountUsed > sub.WindowAmount || windowReserved > sub.WindowAmount-sub.WindowAmountUsed || delta > sub.WindowAmount-sub.WindowAmountUsed-windowReserved {
				return errors.New("subscription reservation exceeds current window quota")
			}
		}
		record.PreConsumed += delta
		sub.AmountReserved += delta
		if err := tx.Save(&sub).Error; err != nil {
			return err
		}
		return tx.Save(&record).Error
	})
}

// SubscriptionSettlement records the committed funding portions of a request.
type SubscriptionSettlement struct {
	SubscriptionAmount  int64
	WalletAmount        int64
	UnfundedAmount      int64
	TotalUsed           int64
	AllowWalletOverflow bool
}

// PrepareSubscriptionTaskSettlement gives completion's additional charge its
// own durable record. Submission is already settled; its original generation
// must still govern which window completion may charge. Legacy subscriptions
// return an empty record and retain their existing adjustment path.
func PrepareSubscriptionTaskSettlement(requestId string) (*SubscriptionPreConsumeRecord, int64, error) {
	var completion SubscriptionPreConsumeRecord
	var submitted int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var original SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&original).Error; err != nil {
			return err
		}
		var sub UserSubscription
		if err := tx.First(&sub, original.UserSubscriptionId).Error; err != nil {
			return err
		}
		if original.Status == "reserved" || original.Status == "consumed" {
			return nil
		}
		if original.Status != "settled" {
			return errors.New("task submission funding has not settled")
		}
		submitted = original.SettlementAmount
		if submitted == 0 {
			submitted = original.SettledAmount
		}
		completion = SubscriptionPreConsumeRecord{
			RequestId: fmt.Sprintf("%x", common.Sha256Raw([]byte("task-completion:"+requestId))),
			UserId:    original.UserId, UserSubscriptionId: original.UserSubscriptionId,
			PlanVersionId:   original.PlanVersionId,
			ResetGeneration: original.ResetGeneration, WalletAuthorized: original.WalletAuthorized, Status: "reserved",
		}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&completion).Error; err != nil {
			return err
		}
		return tx.Where("request_id = ?", completion.RequestId).First(&completion).Error
	})
	return &completion, submitted, err
}

// SettleUserSubscriptionPreConsume retains the subscription-only settlement API.
func SettleUserSubscriptionPreConsume(requestId string, delta int64) error {
	result, err := SettleUserSubscriptionFunding(requestId, delta)
	if err == nil && result.UnfundedAmount > 0 {
		return errors.New("subscription settlement exceeds total quota")
	}
	return err
}

// SettleUserSubscriptionFunding commits the subscription portion once, even
// when the remaining actual cost needs a separate wallet transaction.
func SettleUserSubscriptionFunding(requestId string, delta int64) (*SubscriptionSettlement, error) {
	if strings.TrimSpace(requestId) == "" {
		return nil, errors.New("requestId is empty")
	}
	result := &SubscriptionSettlement{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var record SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&record).Error; err != nil {
			return err
		}
		if record.Status != "reserved" && record.Status != "consumed" && record.Status != "settled" {
			return errors.New("subscription pre-consume is not settleable")
		}
		maxInt64 := int64(^uint64(0) >> 1)
		minInt64 := -maxInt64 - 1
		if record.PreConsumed < 0 || delta == minInt64 || delta > 0 && record.PreConsumed > maxInt64-delta || delta < 0 && record.PreConsumed < -delta {
			return errors.New("subscription settlement cannot be negative")
		}
		actual := record.PreConsumed + delta
		var sub UserSubscription
		if err := lockForUpdate(tx).Where("id = ?", record.UserSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		if record.Status == "settled" {
			// Records settled before funding splits have no SettlementAmount.
			settlementAmount := record.SettlementAmount
			if settlementAmount == 0 {
				settlementAmount = record.SettledAmount
			}
			if sub.QuotaModelVersion > 0 && actual != settlementAmount {
				return errors.New("subscription settlement amount does not match committed charge")
			}
			result.SubscriptionAmount = record.SettledAmount
			result.WalletAmount = record.WalletSettledAmount
			result.UnfundedAmount = settlementAmount - record.SettledAmount - record.WalletSettledAmount
			result.TotalUsed = sub.AmountUsed
			result.AllowWalletOverflow = sub.QuotaModelVersion > 0 && sub.AllowWalletOverflow && record.WalletAuthorized
			return nil
		}
		record.SettlementAmount = actual
		if sub.QuotaModelVersion > 0 {
			if sub.TotalAmountUsed < 0 || sub.HistoricalAmountUsed < 0 || sub.AmountReserved < record.PreConsumed || sub.WindowAmountUsed < 0 {
				return errors.New("subscription quota accounting is invalid")
			}
			otherReserved := sub.AmountReserved - record.PreConsumed
			if sub.AmountTotal > 0 {
				available := max(max(sub.AmountTotal-sub.TotalAmountUsed, 0)-otherReserved, 0)
				actual = min(actual, available)
			}
			if actual > maxInt64-sub.TotalAmountUsed || actual > maxInt64-sub.HistoricalAmountUsed {
				return errors.New("subscription settlement exceeds supported quota")
			}
			if record.ResetGeneration == sub.ResetGeneration && NormalizeResetPeriod(sub.QuotaResetPeriod) != SubscriptionResetNever && sub.AmountTotal > 0 {
				var otherWindowReserved int64
				if err := tx.Model(&SubscriptionPreConsumeRecord{}).
					Select("COALESCE(SUM(pre_consumed), 0)").
					Where("user_subscription_id = ? AND status = ? AND reset_generation = ? AND request_id <> ?", sub.Id, "reserved", record.ResetGeneration, requestId).
					Scan(&otherWindowReserved).Error; err != nil {
					return err
				}
				// The shared charge updates both counters once. Any further
				// subscription charge uses only the remaining total allowance.
				windowCharge := min(actual, max(max(sub.WindowAmount-sub.WindowAmountUsed, 0)-otherWindowReserved, 0))
				sub.WindowAmountUsed += windowCharge
			}
			sub.AmountReserved = otherReserved
			sub.TotalAmountUsed += actual
			sub.HistoricalAmountUsed += actual
			sub.AmountUsed = sub.TotalAmountUsed
			record.SettledAmount = actual
		} else {
			charge := delta
			if record.ResetGeneration != sub.ResetGeneration {
				// Legacy resets erase the old counter, so charge the full request
				// into the only counter available instead of losing its usage.
				charge = actual
			}
			if charge > 0 && sub.AmountUsed > maxInt64-charge {
				return errors.New("subscription settlement exceeds supported quota")
			}
			newUsed := sub.AmountUsed + charge
			if newUsed < 0 {
				newUsed = 0
			}
			if sub.AmountTotal > 0 && newUsed > sub.AmountTotal {
				return errors.New("subscription used exceeds total")
			}
			sub.AmountUsed = newUsed
			record.SettledAmount = actual
		}
		if err := tx.Save(&sub).Error; err != nil {
			return err
		}
		record.Status = "settled"
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		result.SubscriptionAmount = record.SettledAmount
		result.UnfundedAmount = record.SettlementAmount - record.SettledAmount
		result.TotalUsed = sub.AmountUsed
		result.AllowWalletOverflow = sub.QuotaModelVersion > 0 && sub.AllowWalletOverflow && record.WalletAuthorized
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// SettleSubscriptionWalletOverflow commits a request's remaining cost and its
// idempotency marker in one transaction. It preserves wallet settlement's
// existing unconditional debit semantics, bypassing the asynchronous batch queue.
func SettleSubscriptionWalletOverflow(requestId string) (int64, error) {
	var charged, walletAmount int64
	var userId int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var record SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&record).Error; err != nil {
			return err
		}
		if record.Status != "settled" {
			return errors.New("subscription funding has not settled")
		}
		walletAmount = record.WalletSettledAmount
		remaining := record.SettlementAmount - record.SettledAmount - walletAmount
		if remaining <= 0 {
			return nil
		}
		var sub UserSubscription
		if err := tx.First(&sub, record.UserSubscriptionId).Error; err != nil {
			return err
		}
		if sub.QuotaModelVersion == 0 || !sub.AllowWalletOverflow || !record.WalletAuthorized {
			return errors.New("subscription wallet overflow is disabled")
		}
		userId = record.UserId
		var user User
		if err := lockForUpdate(tx).First(&user, userId).Error; err != nil {
			return err
		}
		minInt64 := -int64(^uint64(0)>>1) - 1
		if int64(user.Quota) < minInt64+remaining {
			return errors.New("wallet settlement exceeds supported quota")
		}
		update := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota - ?", remaining))
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		record.WalletSettledAmount += remaining
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		charged = remaining
		walletAmount = record.WalletSettledAmount
		return nil
	})
	if err != nil {
		return 0, err
	}
	if charged > 0 {
		if err := cacheDecrUserQuota(userId, charged); err != nil {
			common.SysLog(common.LogText("failed to decrease user quota cache after subscription settlement: %s", err.Error()))
		}
	}
	return walletAmount, nil
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

// CleanupSubscriptionPreConsumeRecords removes expired refund receipts only.
// Active reservations and settled funding remain authoritative for task
// completion, wallet recovery, and later refunds, regardless of their age.
func CleanupSubscriptionPreConsumeRecords(olderThanSeconds int64) (int64, error) {
	if olderThanSeconds <= 0 {
		olderThanSeconds = 7 * 24 * 3600
	}
	cutoff := GetDBTimestamp() - olderThanSeconds
	res := DB.Where("updated_at < ? AND status = ?", cutoff, "refunded").Delete(&SubscriptionPreConsumeRecord{})
	return res.RowsAffected, res.Error
}

type SubscriptionPlanInfo struct {
	PlanId        int    `json:"plan_id"`
	PlanTitle     string `json:"plan_title"`
	PlanVersionId int    `json:"plan_version_id"`
	PlanVersion   int    `json:"plan_version"`
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
	var planTitle string
	planVersionID := sub.PlanVersionId
	planVersionNumber := 0
	if sub.PlanVersionId > 0 {
		version, err := GetSubscriptionPlanVersionById(sub.PlanVersionId)
		if err != nil {
			return nil, err
		}
		versionPlan, err := version.PlanTerms()
		if err != nil {
			return nil, err
		}
		planTitle = versionPlan.Title
		planVersionNumber = version.Version
	}
	if planTitle == "" {
		plan, err := getSubscriptionPlanByIdTx(nil, sub.PlanId)
		if err != nil {
			return nil, err
		}
		planTitle = plan.Title
	}
	info := &SubscriptionPlanInfo{
		PlanId:        sub.PlanId,
		PlanTitle:     planTitle,
		PlanVersionId: planVersionID,
		PlanVersion:   planVersionNumber,
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
		newUsed := max(sub.AmountUsed+delta, 0)
		if sub.AmountTotal > 0 && newUsed > sub.AmountTotal {
			return fmt.Errorf("subscription used exceeds total, used=%d total=%d", newUsed, sub.AmountTotal)
		}
		sub.AmountUsed = newUsed
		return tx.Save(&sub).Error
	})
}
