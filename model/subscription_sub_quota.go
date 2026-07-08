package model

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Subscription sub-quota window anchor options
const (
	SubQuotaAnchorSubscriptionStart = "subscription_start"
	SubQuotaAnchorCalendar          = "calendar"
)

// SubQuotaLimitPeriodUnit values
const (
	SubQuotaPeriodHour   = "hour"
	SubQuotaPeriodDay    = "day"
	SubQuotaPeriodWeek   = "week"
	SubQuotaPeriodMonth  = "month"
	SubQuotaMaxSubLimits = 2
)

// SubscriptionSubQuotaLimit is one sub-quota window limit configuration.
// Stored as JSON text in subscription_plans.sub_quota_limits and
// user_subscriptions.sub_quota_limits (purchase-time snapshot).
type SubscriptionSubQuotaLimit struct {
	Name        string  `json:"name"`
	PeriodUnit  string  `json:"period_unit"`
	PeriodValue float64 `json:"period_value"`
	LimitUSD    float64 `json:"limit_usd"`
	Natural     bool    `json:"natural,omitempty"`
	Anchor      string  `json:"anchor,omitempty"`
}

// MainQuotaUsage is the user-facing summary of the main subscription quota.
type MainQuotaUsage struct {
	LimitUSD       float64 `json:"limit_usd"`
	UsedUSD        float64 `json:"used_usd"`
	RemainingUSD   float64 `json:"remaining_usd"`
	Percent        float64 `json:"percent"`
	LimitQuota     int64   `json:"limit_quota"`
	UsedQuota      int64   `json:"used_quota"`
	RemainingQuota int64   `json:"remaining_quota"`
	ResetTime      int64   `json:"reset_time"`
	Exceeded       bool    `json:"exceeded"`
}

// SubscriptionSubQuotaUsage is the user-facing summary of one sub-quota limit.
type SubscriptionSubQuotaUsage struct {
	Name           string  `json:"name"`
	PeriodUnit     string  `json:"period_unit"`
	PeriodValue    float64 `json:"period_value"`
	Natural        bool    `json:"natural"`
	Anchor         string  `json:"anchor"`
	LimitUSD       float64 `json:"limit_usd"`
	UsedUSD        float64 `json:"used_usd"`
	RemainingUSD   float64 `json:"remaining_usd"`
	Percent        float64 `json:"percent"`
	LimitQuota     int64   `json:"limit_quota"`
	UsedQuota      int64   `json:"used_quota"`
	RemainingQuota int64   `json:"remaining_quota"`
	WindowStart    int64   `json:"window_start"`
	WindowEnd      int64   `json:"window_end"`
	ResetTime      int64   `json:"reset_time"`
	Exceeded       bool    `json:"exceeded"`
}

// usdToSubQuota converts a USD amount to internal quota units, saturating at
// the int32 max to keep quota columns 32-bit safe.
func usdToSubQuota(usd float64) int64 {
	if usd <= 0 || common.QuotaPerUnit <= 0 {
		return 0
	}
	q := decimal.NewFromFloat(usd).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Ceil().
		IntPart()
	if q > int64(common.MaxQuota) {
		q = int64(common.MaxQuota)
	}
	return q
}

// subQuotaToUSD converts internal quota units back to USD for display.
func subQuotaToUSD(quota int64) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	v, _ := decimal.NewFromInt(quota).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Float64()
	return v
}

// parseSubQuotaLimits parses the stored JSON text into sub-limit configs.
// Empty / null / "null" / "[]" are all treated as "no sub-limit".
func parseSubQuotaLimits(raw string) ([]SubscriptionSubQuotaLimit, error) {
	s := strings.TrimSpace(raw)
	if s == "" || s == "null" {
		return nil, nil
	}
	var limits []SubscriptionSubQuotaLimit
	if err := common.UnmarshalJsonStr(s, &limits); err != nil {
		return nil, fmt.Errorf("invalid sub_quota_limits: %w", err)
	}
	return limits, nil
}

// ValidateAndNormalizeSubQuotaLimits validates and fills defaults for up to 2
// sub-quota limits. Returns the normalized slice, ready to be persisted as JSON.
func ValidateAndNormalizeSubQuotaLimits(limits []SubscriptionSubQuotaLimit) ([]SubscriptionSubQuotaLimit, error) {
	if len(limits) == 0 {
		return []SubscriptionSubQuotaLimit{}, nil
	}
	if len(limits) > SubQuotaMaxSubLimits {
		return nil, errors.New("子限制最多只能添加 2 条")
	}
	out := make([]SubscriptionSubQuotaLimit, 0, len(limits))
	for _, limit := range limits {
		if limit.LimitUSD <= 0 {
			return nil, errors.New("子限制额度必须大于 0")
		}
		if limit.PeriodValue <= 0 {
			return nil, errors.New("子限制周期数量必须大于 0")
		}
		switch limit.PeriodUnit {
		case SubQuotaPeriodHour:
			// natural is meaningless for hour windows; force fixed-window semantics.
			limit.Natural = false
			if limit.Anchor == "" {
				limit.Anchor = SubQuotaAnchorSubscriptionStart
			}
			if limit.Anchor != SubQuotaAnchorSubscriptionStart && limit.Anchor != SubQuotaAnchorCalendar {
				return nil, fmt.Errorf("小时子限制 anchor 只能是 %s 或 %s",
					SubQuotaAnchorSubscriptionStart, SubQuotaAnchorCalendar)
			}
		case SubQuotaPeriodWeek:
			if limit.PeriodValue < 1 {
				return nil, errors.New("周子限制周期数量必须大于等于 1")
			}
			if limit.Anchor == "" {
				limit.Anchor = SubQuotaAnchorCalendar
			}
		case SubQuotaPeriodDay, SubQuotaPeriodMonth:
			if limit.PeriodValue != math.Trunc(limit.PeriodValue) {
				return nil, fmt.Errorf("%s 子限制周期数量必须是整数", limit.PeriodUnit)
			}
			if limit.Anchor == "" {
				limit.Anchor = SubQuotaAnchorCalendar
			}
		default:
			return nil, fmt.Errorf("不支持的子限制周期类型: %s", limit.PeriodUnit)
		}
		out = append(out, limit)
	}
	return out, nil
}

// SerializeSubQuotaLimits marshals limits to the persisted JSON text form.
func SerializeSubQuotaLimits(limits []SubscriptionSubQuotaLimit) (string, error) {
	if len(limits) == 0 {
		return "", nil
	}
	b, err := common.Marshal(limits)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// NormalizeAndSerializeSubQuotaLimits is a convenience helper: validate then
// store back as JSON text.
func NormalizeAndSerializeSubQuotaLimits(raw string) (string, error) {
	limits, err := parseSubQuotaLimits(raw)
	if err != nil {
		return "", err
	}
	normalized, err := ValidateAndNormalizeSubQuotaLimits(limits)
	if err != nil {
		return "", err
	}
	return SerializeSubQuotaLimits(normalized)
}

// calcSubLimitWindow returns [windowStart, windowEnd) covering nowUnix for the
// given limit and subscription.
func calcSubLimitWindow(sub *UserSubscription, limit SubscriptionSubQuotaLimit, nowUnix int64) (int64, int64, error) {
	if sub == nil {
		return 0, 0, errors.New("subscription is nil")
	}
	loc := time.Local
	now := time.Unix(nowUnix, 0).In(loc)

	switch limit.PeriodUnit {
	case SubQuotaPeriodHour:
		if limit.Anchor == SubQuotaAnchorCalendar {
			start, end := calcFixedHourWindowByDayStart(limit.PeriodValue, nowUnix, loc)
			return start, end, nil
		}
		start, end := calcFixedHourWindowBySubscriptionStart(sub.StartTime, limit.PeriodValue, nowUnix)
		return start, end, nil

	case SubQuotaPeriodDay:
		days := int(limit.PeriodValue)
		if limit.Natural {
			start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
			end := start.AddDate(0, 0, days)
			return start.Unix(), end.Unix(), nil
		}
		start := now.AddDate(0, 0, -days)
		return start.Unix(), nowUnix, nil

	case SubQuotaPeriodWeek:
		blockSeconds := int64(math.Ceil(limit.PeriodValue * 7 * 24 * 3600))
		if limit.Anchor == SubQuotaAnchorSubscriptionStart {
			start, end := calcFixedDurationWindowBySubscriptionStart(sub.StartTime, blockSeconds, nowUnix)
			return start, end, nil
		}
		start, end := calcFixedDurationWindowByWeekStart(blockSeconds, nowUnix, loc)
		return start, end, nil

	case SubQuotaPeriodMonth:
		months := int(limit.PeriodValue)
		if limit.Natural {
			start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
			end := start.AddDate(0, months, 0)
			return start.Unix(), end.Unix(), nil
		}
		start := now.AddDate(0, -months, 0)
		return start.Unix(), nowUnix, nil
	}
	return 0, 0, fmt.Errorf("不支持的子限制周期类型: %s", limit.PeriodUnit)
}

// calcFixedHourWindowBySubscriptionStart slices fixed N-hour blocks aligned to
// the subscription start time.
func calcFixedHourWindowBySubscriptionStart(subStartUnix int64, hours float64, nowUnix int64) (int64, int64) {
	blockSeconds := int64(math.Ceil(hours * 3600))
	return calcFixedDurationWindowBySubscriptionStart(subStartUnix, blockSeconds, nowUnix)
}

func calcFixedDurationWindowBySubscriptionStart(subStartUnix int64, blockSeconds int64, nowUnix int64) (int64, int64) {
	if blockSeconds <= 0 {
		blockSeconds = 1
	}
	if nowUnix <= subStartUnix {
		return subStartUnix, subStartUnix + blockSeconds
	}
	elapsed := nowUnix - subStartUnix
	blockIndex := elapsed / blockSeconds
	start := subStartUnix + blockIndex*blockSeconds
	end := start + blockSeconds
	return start, end
}

// calcFixedHourWindowByDayStart slices fixed N-hour blocks aligned to local
// day start 00:00.
func calcFixedHourWindowByDayStart(hours float64, nowUnix int64, loc *time.Location) (int64, int64) {
	blockSeconds := int64(math.Ceil(hours * 3600))
	if blockSeconds <= 0 {
		blockSeconds = 1
	}
	now := time.Unix(nowUnix, 0).In(loc)
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	secondsFromDayStart := int64(now.Sub(dayStart).Seconds())
	blockIndex := secondsFromDayStart / blockSeconds
	start := dayStart.Add(time.Duration(blockIndex*blockSeconds) * time.Second)
	end := start.Add(time.Duration(blockSeconds) * time.Second)
	return start.Unix(), end.Unix()
}

func calcFixedDurationWindowByWeekStart(blockSeconds int64, nowUnix int64, loc *time.Location) (int64, int64) {
	if blockSeconds <= 0 {
		blockSeconds = 1
	}
	now := time.Unix(nowUnix, 0).In(loc)
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	weekStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -(weekday - 1))
	secondsFromWeekStart := int64(now.Sub(weekStart).Seconds())
	blockIndex := secondsFromWeekStart / blockSeconds
	start := weekStart.Add(time.Duration(blockIndex*blockSeconds) * time.Second)
	end := start.Add(time.Duration(blockSeconds) * time.Second)
	return start.Unix(), end.Unix()
}

// sumConsumeQuotaInWindow sums the quota of consume logs for a user in
// [effectiveStart, windowEnd), where effectiveStart = max(windowStart, resetAt).
// resetAt=0 means no reset, count from the natural window start.
func sumConsumeQuotaInWindow(userId int, windowStart, windowEnd, resetAt int64) (int64, error) {
	if userId <= 0 || windowEnd <= windowStart {
		return 0, nil
	}
	effectiveStart := windowStart
	if resetAt > effectiveStart {
		effectiveStart = resetAt
	}
	if effectiveStart >= windowEnd {
		return 0, nil
	}
	var usedQuota int64
	err := LOG_DB.Model(&Log{}).
		Select("COALESCE(SUM(quota), 0)").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?",
			userId, LogTypeConsume, effectiveStart, windowEnd).
		Scan(&usedQuota).Error
	if err != nil {
		return 0, err
	}
	return usedQuota, nil
}

// checkSubscriptionSubLimits verifies the candidate pre-consume amount does
// not exceed any sub-limit window. Returns nil on success, error on violation.
func checkSubscriptionSubLimits(tx *gorm.DB, userId int, sub *UserSubscription, amount int64, now int64) error {
	if sub == nil || amount <= 0 {
		return nil
	}
	limits, err := parseSubQuotaLimits(sub.SubQuotaLimits)
	if err != nil {
		return err
	}
	if len(limits) == 0 {
		return nil
	}
	if len(limits) > SubQuotaMaxSubLimits {
		limits = limits[:SubQuotaMaxSubLimits]
	}
	queryDB := LOG_DB
	if tx != nil && tx != LOG_DB {
		// sub-limit check is read-only; use LOG_DB for the consume-log table.
		_ = queryDB
	}
	for _, limit := range limits {
		if limit.LimitUSD <= 0 {
			continue
		}
		limitQuota := usdToSubQuota(limit.LimitUSD)
		if limitQuota <= 0 {
			continue
		}
		windowStart, windowEnd, err := calcSubLimitWindow(sub, limit, now)
		if err != nil {
			return err
		}
		usedQuota, err := sumConsumeQuotaInWindow(userId, windowStart, windowEnd, sub.SubQuotaResetAt)
		if err != nil {
			return err
		}
		if usedQuota+amount > limitQuota {
			return fmt.Errorf("子限制额度不足: %s used=%d need=%d limit=%d reset=%d",
				limit.Name, usedQuota, amount, limitQuota, windowEnd)
		}
	}
	return nil
}

// BuildMainQuotaUsage returns the main-quota usage summary for a subscription.
func BuildMainQuotaUsage(sub *UserSubscription) *MainQuotaUsage {
	if sub == nil {
		return nil
	}
	total := sub.AmountTotal
	used := sub.AmountUsed
	if total <= 0 {
		// unlimited: report zeroed usage with reset time only
		return &MainQuotaUsage{
			ResetTime: sub.NextResetTime,
		}
	}
	remaining := total - used
	if remaining < 0 {
		remaining = 0
	}
	percent := 0.0
	if total > 0 {
		percent = float64(used) / float64(total) * 100
		if percent > 100 {
			percent = 100
		}
	}
	return &MainQuotaUsage{
		LimitUSD:       subQuotaToUSD(total),
		UsedUSD:        subQuotaToUSD(used),
		RemainingUSD:   subQuotaToUSD(remaining),
		Percent:        percent,
		LimitQuota:     total,
		UsedQuota:      used,
		RemainingQuota: remaining,
		ResetTime:      sub.NextResetTime,
		Exceeded:       used >= total,
	}
}

// BuildSubQuotaUsage returns the per-limit usage summary list for a
// subscription at nowUnix. Returns an empty slice if there are no sub-limits.
func BuildSubQuotaUsage(userId int, sub *UserSubscription, nowUnix int64) ([]SubscriptionSubQuotaUsage, error) {
	if sub == nil {
		return []SubscriptionSubQuotaUsage{}, nil
	}
	limits, err := parseSubQuotaLimits(sub.SubQuotaLimits)
	if err != nil {
		return nil, err
	}
	if len(limits) == 0 {
		return []SubscriptionSubQuotaUsage{}, nil
	}
	if len(limits) > SubQuotaMaxSubLimits {
		limits = limits[:SubQuotaMaxSubLimits]
	}
	usages := make([]SubscriptionSubQuotaUsage, 0, len(limits))
	for _, limit := range limits {
		limitQuota := usdToSubQuota(limit.LimitUSD)
		if limitQuota <= 0 {
			continue
		}
		windowStart, windowEnd, err := calcSubLimitWindow(sub, limit, nowUnix)
		if err != nil {
			return nil, err
		}
		usedQuota, err := sumConsumeQuotaInWindow(userId, windowStart, windowEnd, sub.SubQuotaResetAt)
		if err != nil {
			return nil, err
		}
		remainingQuota := limitQuota - usedQuota
		if remainingQuota < 0 {
			remainingQuota = 0
		}
		percent := 0.0
		if limitQuota > 0 {
			percent = float64(usedQuota) / float64(limitQuota) * 100
			if percent > 100 {
				percent = 100
			}
		}
		usages = append(usages, SubscriptionSubQuotaUsage{
			Name:           limit.Name,
			PeriodUnit:     limit.PeriodUnit,
			PeriodValue:    limit.PeriodValue,
			Natural:        limit.Natural,
			Anchor:         limit.Anchor,
			LimitUSD:       limit.LimitUSD,
			UsedUSD:        subQuotaToUSD(usedQuota),
			RemainingUSD:   subQuotaToUSD(remainingQuota),
			Percent:        percent,
			LimitQuota:     limitQuota,
			UsedQuota:      usedQuota,
			RemainingQuota: remainingQuota,
			WindowStart:    windowStart,
			WindowEnd:      windowEnd,
			ResetTime:      windowEnd,
			Exceeded:       usedQuota >= limitQuota,
		})
	}
	return usages, nil
}

// AutoMigrateSubscriptionSubQuotaLimits ensures the sub_quota_limits column
// exists on both tables. Safe to call on every startup.
func AutoMigrateSubscriptionSubQuotaLimits() error {
	if DB == nil {
		return errors.New("DB is nil")
	}
	if !DB.Migrator().HasColumn(&SubscriptionPlan{}, "sub_quota_limits") {
		if err := DB.Migrator().AddColumn(&SubscriptionPlan{}, "SubQuotaLimits"); err != nil {
			return fmt.Errorf("add subscription_plans.sub_quota_limits: %w", err)
		}
	}
	if !DB.Migrator().HasColumn(&UserSubscription{}, "sub_quota_limits") {
		if err := DB.Migrator().AddColumn(&UserSubscription{}, "SubQuotaLimits"); err != nil {
			return fmt.Errorf("add user_subscriptions.sub_quota_limits: %w", err)
		}
	}
	if !DB.Migrator().HasColumn(&UserSubscription{}, "sub_quota_reset_at") {
		if err := DB.Migrator().AddColumn(&UserSubscription{}, "SubQuotaResetAt"); err != nil {
			return fmt.Errorf("add user_subscriptions.sub_quota_reset_at: %w", err)
		}
	}
	// Best-effort index: per-user consume-log window scans. CreateIndex with a
	// name maps poorly across dialects; issue the DDL directly to make sure the
	// composite (user_id, type, created_at) index exists on all three DBs.
	indexName := "idx_logs_user_type_created_at"
	if !LOG_DB.Migrator().HasIndex(&Log{}, indexName) {
		if err := LOG_DB.Exec("CREATE INDEX IF NOT EXISTS " + indexName + " ON logs(user_id, type, created_at)").Error; err != nil {
			common.SysError("create " + indexName + " failed: " + err.Error())
		}
	}
	return nil
}

// BackfillActiveSubscriptionSubQuotaLimitsFromPlan copies the plan sub-quota
// limits into active subscriptions that don't have one yet. Only runs when the
// MIGRATE_ACTIVE_SUBSCRIPTION_SUB_LIMITS_FROM_PLAN env switch is set.
func BackfillActiveSubscriptionSubQuotaLimitsFromPlan() error {
	now := common.GetTimestamp()
	// SQLite/MySQL/PostgreSQL all support this correlated subquery. Quoting is
	// neutral; identifiers here are all non-reserved.
	return DB.Exec(`
UPDATE user_subscriptions
SET sub_quota_limits = (
    SELECT subscription_plans.sub_quota_limits
    FROM subscription_plans
    WHERE subscription_plans.id = user_subscriptions.plan_id
)
WHERE status = ?
  AND end_time > ?
  AND (sub_quota_limits IS NULL OR sub_quota_limits = '')
`, "active", now).Error
}

// MaybeBackfillSubscriptionSubQuotaLimits runs the one-shot backfill when the
// operator has opted in via env switch.
func MaybeBackfillSubscriptionSubQuotaLimits() {
	if !common.GetEnvOrDefaultBool("MIGRATE_ACTIVE_SUBSCRIPTION_SUB_LIMITS_FROM_PLAN", false) {
		return
	}
	if err := BackfillActiveSubscriptionSubQuotaLimitsFromPlan(); err != nil {
		common.SysError("backfill active subscription sub_quota_limits failed: " + err.Error())
		return
	}
	common.SysLog("backfilled active subscription sub_quota_limits from plan")
}
