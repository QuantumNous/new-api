package service

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/cachex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/savings_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
	"github.com/shopspring/decimal"
	"golang.org/x/sync/singleflight"
)

const (
	savingsEstimateSchemaVersion  = 1
	savingsTextCalculator         = "text_token_v1"
	savingsHistoricalCalculator   = "historical_text_rebuild_v1"
	savingsCalculationSnapshot    = "snapshot"
	savingsCalculationHistorical  = "historical_rebuild"
	savingsSourceLocalPricing     = "local_pricing_snapshot"
	savingsSourceOfficialOverride = "official_override"
	savingsSourceMixed            = "mixed"

	SavingsSkipDisabled                  = "disabled"
	SavingsSkipMissingOfficialPrice      = "missing_official_price"
	SavingsSkipUnconfirmedOfficialPrice  = "unconfirmed_official_price"
	SavingsSkipMissingUsage              = "missing_usage"
	SavingsSkipUnsupportedBillingMode    = "unsupported_billing_mode"
	SavingsSkipUnknownExtraRatio         = "unknown_extra_ratio"
	SavingsSkipQuotaSaturated            = "quota_saturated"
	SavingsSkipInvalidSnapshot           = "invalid_snapshot"
	SavingsSkipLegacyMissingBaseFields   = "legacy_log_missing_base_fields"
	SavingsSkipLegacyInvalidSnapshot     = "legacy_log_invalid_snapshot"
	SavingsSkipLegacyActualQuotaMismatch = "legacy_actual_quota_mismatch"

	SavingsTrendGranularityHour = "hour"
	SavingsTrendGranularityDay  = "day"
	savingsTrendMaxBuckets      = 64
	savingsTrendMaxHourSeconds  = 48 * 3600
	savingsResultCacheTTL       = time.Minute
	savingsResultCacheCapacity  = 5000
	savingsSummaryCacheKind     = "summary"
	savingsTrendCacheKind       = "trend"
	savingsSummaryCacheNS       = "new-api:user_savings_summary:v1"
	savingsTrendCacheNS         = "new-api:user_savings_trend:v1"
)

var (
	ErrSavingsTimeRangeRequired = errors.New("savings time range is required")
	ErrSavingsUTCOffsetRequired = errors.New("savings UTC offset is required")
	ErrSavingsUTCOffsetInvalid  = errors.New("savings UTC offset is invalid")
	ErrSavingsEndAfterNow       = errors.New("savings end time is after current time")
	ErrSavingsTimeRangeInvalid  = errors.New("savings time range is invalid")
	ErrSavingsTimeRangeTooLarge = errors.New("savings time range is too large")
	ErrSavingsHourRangeTooLarge = errors.New("hourly savings time range is too large")
	ErrSavingsGranularity       = errors.New("savings trend granularity is invalid")
	ErrSavingsTooManyBuckets    = errors.New("savings trend has too many buckets")

	savingsSummaryCacheOnce sync.Once
	savingsSummaryCache     *cachex.HybridCache[SavingsSummary]
	savingsSummaryGroup     singleflight.Group
	savingsTrendCacheOnce   sync.Once
	savingsTrendCache       *cachex.HybridCache[SavingsTrend]
	savingsTrendGroup       singleflight.Group
)

type SavingsEstimate struct {
	SchemaVersion     int    `json:"schema_version"`
	Calculator        string `json:"calculator"`
	OfficialQuota     int    `json:"official_quota"`
	ActualQuota       int    `json:"actual_quota"`
	SavingsQuota      int    `json:"savings_quota"`
	Source            string `json:"source"`
	SourceURL         string `json:"source_url,omitempty"`
	SourceUpdatedAt   int64  `json:"source_updated_at"`
	PriceSnapshotAt   int64  `json:"price_snapshot_at,omitempty"`
	PriceFingerprint  string `json:"price_fingerprint,omitempty"`
	OfficialConfirmed bool   `json:"official_confirmed"`
	MatchedModel      string `json:"matched_model"`
	PricingMode       string `json:"pricing_mode"`
	CalculationMode   string `json:"calculation_mode,omitempty"`
	Estimated         bool   `json:"estimated"`
	AggregationKey    string `json:"savings_aggregation_key,omitempty"`
	QuotaPerUnit      int64  `json:"quota_per_unit_snapshot,omitempty"`
	USDCNYRateMicros  int64  `json:"usd_cny_rate_micros,omitempty"`
	SavingsCNYMicros  string `json:"savings_cny_micros,omitempty"`
}

type SavingsEstimateResult struct {
	Estimate   *SavingsEstimate
	SkipReason string
}

type SavingsSummary struct {
	Enabled                   bool    `json:"enabled"`
	SavingsQuota              int64   `json:"savings_quota"`
	OfficialQuota             int64   `json:"official_quota"`
	ActualQuota               int64   `json:"actual_quota"`
	RequestCount              int64   `json:"request_count"`
	EstimatedRequestCount     int64   `json:"estimated_request_count"`
	SnapshotRequestCount      int64   `json:"snapshot_request_count"`
	ReconstructedRequestCount int64   `json:"reconstructed_request_count"`
	CoverageRatio             float64 `json:"coverage_ratio"`
	Source                    string  `json:"source"`
	OfficialConfirmed         bool    `json:"official_confirmed"`
	SourceUpdatedAt           int64   `json:"source_updated_at"`
	RebuildPriceSnapshotAt    int64   `json:"rebuild_price_snapshot_at"`
	OfficialPriceStale        bool    `json:"official_price_stale"`
	IsPartial                 bool    `json:"is_partial"`
	WindowDays                int     `json:"window_days"`
}

type SavingsTrendBucket struct {
	StartTimestamp            int64   `json:"start_timestamp"`
	EndTimestamp              int64   `json:"end_timestamp"`
	OfficialQuota             int64   `json:"official_quota"`
	ActualQuota               int64   `json:"actual_quota"`
	SavingsQuota              int64   `json:"savings_quota"`
	RequestCount              int64   `json:"request_count"`
	EstimatedRequestCount     int64   `json:"estimated_request_count"`
	SnapshotRequestCount      int64   `json:"snapshot_request_count"`
	ReconstructedRequestCount int64   `json:"reconstructed_request_count"`
	CoverageRatio             float64 `json:"coverage_ratio"`
}

type SavingsTrend struct {
	Granularity      string               `json:"granularity"`
	UTCOffsetMinutes int                  `json:"utc_offset_minutes"`
	StartTimestamp   int64                `json:"start_timestamp"`
	EndTimestamp     int64                `json:"end_timestamp"`
	Summary          SavingsSummary       `json:"summary"`
	Buckets          []SavingsTrendBucket `json:"buckets"`
}

type savingsLogEstimate struct {
	Estimate        *SavingsEstimate
	CalculationMode string
	SkipReason      string
}

type savingsLogEstimator struct {
	setting         savings_setting.Setting
	localPrices     map[string]savings_setting.OfficialPrice
	priceSnapshotAt int64
}

type savingsSummaryAccumulator struct {
	summary         *SavingsSummary
	priceSnapshotAt int64
	staleBefore     int64
	sources         map[string]struct{}
	allConfirmed    bool
}

type savingsLogOther struct {
	SavingsEstimate json.RawMessage `json:"savings_estimate"`
	AggregationKey  string          `json:"savings_aggregation_key"`
	AdminInfo       struct {
		SavingsSkipReason string `json:"savings_skip_reason"`
	} `json:"admin_info"`
}

type legacySavingsLogOther struct {
	ModelRatio              *float64 `json:"model_ratio"`
	GroupRatio              *float64 `json:"group_ratio"`
	CompletionRatio         *float64 `json:"completion_ratio"`
	ModelPrice              *float64 `json:"model_price"`
	CacheTokens             *int     `json:"cache_tokens"`
	CacheRatio              *float64 `json:"cache_ratio"`
	CacheCreationTokens     int      `json:"cache_creation_tokens"`
	CacheCreationRatio      *float64 `json:"cache_creation_ratio"`
	CacheCreationTokens5m   int      `json:"cache_creation_tokens_5m"`
	CacheCreationRatio5m    *float64 `json:"cache_creation_ratio_5m"`
	CacheCreationTokens1h   int      `json:"cache_creation_tokens_1h"`
	CacheCreationRatio1h    *float64 `json:"cache_creation_ratio_1h"`
	Image                   bool     `json:"image"`
	ImageOutput             *int     `json:"image_output"`
	ImageRatio              *float64 `json:"image_ratio"`
	UsageSemantic           string   `json:"usage_semantic"`
	Claude                  bool     `json:"claude"`
	BillingMode             string   `json:"billing_mode"`
	Audio                   bool     `json:"audio"`
	WSS                     bool     `json:"ws"`
	WebSearch               bool     `json:"web_search"`
	FileSearch              bool     `json:"file_search"`
	AudioInputSeparatePrice bool     `json:"audio_input_seperate_price"`
	ImageGenerationCall     bool     `json:"image_generation_call"`
	ExprB64                 string   `json:"expr_b64"`
}

type savingsPriceFingerprint struct {
	ModelName            string   `json:"model_name"`
	QuotaType            int      `json:"quota_type"`
	ModelRatio           *float64 `json:"model_ratio"`
	ModelPrice           *float64 `json:"model_price"`
	CompletionRatio      *float64 `json:"completion_ratio"`
	CacheRatio           *float64 `json:"cache_ratio"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio"`
	CacheCreation5mRatio *float64 `json:"cache_creation_ratio_5m"`
	CacheCreation1hRatio *float64 `json:"cache_creation_ratio_1h"`
	ImageRatio           *float64 `json:"image_ratio"`
	AudioRatio           *float64 `json:"audio_ratio"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio"`
	BillingMode          string   `json:"billing_mode"`
	BillingExpr          string   `json:"billing_expr"`
}

func AttachTextSavingsEstimate(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, summary textQuotaSummary, other map[string]interface{}) {
	if other == nil {
		return
	}
	aggregationKey := ""
	if savings_setting.LifetimeEnabled() {
		aggregationKey = "savg_" + common.GetUUID()
		other["savings_aggregation_key"] = aggregationKey
	}
	result := buildTextSavingsEstimate(ctx, relayInfo, summary)
	if result.Estimate == nil {
		if aggregationKey != "" {
			adminInfo, ok := other["admin_info"].(map[string]interface{})
			if !ok || adminInfo == nil {
				adminInfo = map[string]interface{}{}
				other["admin_info"] = adminInfo
			}
			adminInfo["savings_skip_reason"] = result.SkipReason
		}
		return
	}
	attachSavingsLifetimeSnapshot(result.Estimate, aggregationKey)
	other["savings_estimate"] = result.Estimate
}

func attachSavingsLifetimeSnapshot(estimate *SavingsEstimate, aggregationKey string) {
	if estimate == nil || !savings_setting.LifetimeEnabled() {
		return
	}
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit).Round(0)
	rate := decimal.NewFromFloat(operation_setting.USDExchangeRate)
	if quotaPerUnit.LessThanOrEqual(decimal.Zero) || rate.LessThanOrEqual(decimal.Zero) {
		return
	}
	rateMicros := rate.Mul(decimal.NewFromInt(1_000_000)).Round(0)
	amountMicros := decimal.NewFromInt(int64(estimate.SavingsQuota)).
		Div(quotaPerUnit).
		Mul(rate).
		Mul(decimal.NewFromInt(1_000_000)).
		Round(0)
	maxInt64 := decimal.NewFromInt(math.MaxInt64)
	if rateMicros.GreaterThan(maxInt64) || amountMicros.GreaterThan(maxInt64) {
		common.SysError("savings lifetime currency snapshot exceeds int64")
		return
	}
	estimate.AggregationKey = aggregationKey
	estimate.QuotaPerUnit = quotaPerUnit.IntPart()
	estimate.USDCNYRateMicros = rateMicros.IntPart()
	estimate.SavingsCNYMicros = amountMicros.StringFixed(0)
}

func RecordSavingsLifetimeLog(log *model.Log) error {
	if log == nil || !savings_setting.LifetimeEnabled() {
		return nil
	}
	event, ok := buildSavingsLifetimeEvent(log)
	if !ok {
		return nil
	}
	if err := model.CreateSavingsLifetimeEvents([]model.SavingsLifetimeEvent{event}); err != nil {
		return err
	}
	notifySavingsLifetimeAggregator()
	return nil
}

func buildSavingsLifetimeEvent(log *model.Log) (model.SavingsLifetimeEvent, bool) {
	if log == nil {
		return model.SavingsLifetimeEvent{}, false
	}
	var other savingsLogOther
	if err := common.UnmarshalJsonStr(log.Other, &other); err != nil || strings.TrimSpace(other.AggregationKey) == "" {
		return model.SavingsLifetimeEvent{}, false
	}
	event := model.SavingsLifetimeEvent{
		EventKey:         "log:" + other.AggregationKey + ":base",
		SourceKey:        other.AggregationKey,
		LogID:            int64(log.Id),
		UserID:           log.UserId,
		OccurredAt:       log.CreatedAt,
		DayStartUTC:      log.CreatedAt / (24 * 60 * 60) * (24 * 60 * 60),
		EventType:        model.SavingsLifetimeEventTypeBase,
		CoverageState:    model.SavingsLifetimeCoverageSkipped,
		SkipReason:       other.AdminInfo.SavingsSkipReason,
		AggregateVersion: 1,
	}
	estimate := savingsEstimateFromOther(log.Other)
	if estimate != nil {
		amountMicros, err := strconv.ParseInt(estimate.SavingsCNYMicros, 10, 64)
		if err != nil || estimate.QuotaPerUnit <= 0 || estimate.USDCNYRateMicros <= 0 {
			event.SkipReason = SavingsSkipInvalidSnapshot
		} else {
			event.CoverageState = model.SavingsLifetimeCoverageEstimated
			event.SkipReason = ""
			event.CalculationMode = model.SavingsLifetimeCalculationSnapshot
			event.OfficialQuota = int64(estimate.OfficialQuota)
			event.ActualQuota = int64(estimate.ActualQuota)
			event.SavingsQuota = int64(estimate.SavingsQuota)
			event.SavingsCNYMicros = amountMicros
			event.QuotaPerUnitSnapshot = estimate.QuotaPerUnit
			event.USDCNYRateMicros = estimate.USDCNYRateMicros
			event.PriceSnapshotAt = estimate.PriceSnapshotAt
			event.PriceFingerprint = estimate.PriceFingerprint
		}
	}
	if event.SkipReason == "" && event.CoverageState == model.SavingsLifetimeCoverageSkipped {
		event.SkipReason = SavingsSkipInvalidSnapshot
	}
	return event, true
}

func buildTextSavingsEstimate(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, summary textQuotaSummary) SavingsEstimateResult {
	if !savings_setting.IsEnabled() {
		return SavingsEstimateResult{SkipReason: SavingsSkipDisabled}
	}
	if relayInfo == nil {
		return SavingsEstimateResult{SkipReason: SavingsSkipInvalidSnapshot}
	}
	if summary.TotalTokens <= 0 {
		return SavingsEstimateResult{SkipReason: SavingsSkipMissingUsage}
	}
	if summary.Quota < 0 {
		return SavingsEstimateResult{SkipReason: SavingsSkipInvalidSnapshot}
	}
	if relayInfo.PriceData.UsePrice {
		return SavingsEstimateResult{SkipReason: SavingsSkipUnsupportedBillingMode}
	}
	if hasSavingsUnsupportedTextExtra(relayInfo, summary) {
		return SavingsEstimateResult{SkipReason: SavingsSkipUnknownExtraRatio}
	}

	setting := savings_setting.GetSetting()
	price, matchedModel, skipReason := matchSavingsOfficialPrice(setting, relayInfo, summary.ModelName)
	if skipReason != "" {
		return SavingsEstimateResult{SkipReason: skipReason}
	}
	officialQuota, skipReason := calculateOfficialTextQuota(summary, price)
	if skipReason != "" {
		return SavingsEstimateResult{SkipReason: skipReason}
	}

	savingsQuota := officialQuota - summary.Quota
	if savingsQuota < 0 {
		savingsQuota = 0
	}
	return SavingsEstimateResult{
		Estimate: &SavingsEstimate{
			SchemaVersion:     savingsEstimateSchemaVersion,
			Calculator:        savingsTextCalculator,
			OfficialQuota:     officialQuota,
			ActualQuota:       summary.Quota,
			SavingsQuota:      savingsQuota,
			Source:            price.Source,
			SourceURL:         price.SourceURL,
			SourceUpdatedAt:   price.SourceUpdatedAt,
			PriceSnapshotAt:   price.PriceSnapshotAt,
			PriceFingerprint:  price.PriceFingerprint,
			OfficialConfirmed: price.OfficialConfirmed,
			MatchedModel:      matchedModel,
			PricingMode:       savingsPricingMode(price),
			CalculationMode:   savingsCalculationSnapshot,
			Estimated:         true,
		},
	}
}

func GetUserSavingsSummary(userId int, startTimestamp int64, endTimestamp int64) (*SavingsSummary, error) {
	setting := savings_setting.GetSetting()
	cacheKey, err := buildUserSavingsCacheKey(
		savingsSummaryCacheKind,
		userId,
		startTimestamp,
		endTimestamp,
		"",
		0,
		setting,
	)
	if err != nil {
		return nil, err
	}
	result, err := loadCachedSavingsResult(getUserSavingsSummaryCache(), &savingsSummaryGroup, cacheKey, func() (SavingsSummary, error) {
		summary, err := buildUserSavingsSummary(setting, userId, startTimestamp, endTimestamp)
		if err != nil {
			return SavingsSummary{}, err
		}
		return *summary, nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func buildUserSavingsSummary(setting savings_setting.Setting, userId int, startTimestamp int64, endTimestamp int64) (*SavingsSummary, error) {
	summary := newSavingsSummary(setting, startTimestamp, endTimestamp)
	if !summary.Enabled {
		return summary, nil
	}

	rows, total, partial, err := loadUserSavingsRows(userId, startTimestamp, endTimestamp)
	if err != nil {
		return nil, err
	}
	summary.RequestCount = total
	if partial {
		summary.IsPartial = true
		return summary, nil
	}
	if total == 0 {
		return summary, nil
	}

	estimator := newSavingsLogEstimator(setting)
	accumulator := newSavingsSummaryAccumulator(summary, estimator.priceSnapshotAt, setting.OfficialPriceStaleDays)
	for _, row := range rows {
		result := estimator.estimate(row)
		if result.Estimate == nil {
			continue
		}
		if err := accumulator.add(result); err != nil {
			return nil, err
		}
	}
	accumulator.finish()
	return summary, nil
}

func GetUserSavingsTrend(userId int, startTimestamp int64, endTimestamp int64, granularity string, utcOffsetMinutes int) (*SavingsTrend, error) {
	setting := savings_setting.GetSetting()
	cacheKey, err := buildUserSavingsCacheKey(
		savingsTrendCacheKind,
		userId,
		startTimestamp,
		endTimestamp,
		granularity,
		utcOffsetMinutes,
		setting,
	)
	if err != nil {
		return nil, err
	}
	result, err := loadCachedSavingsResult(getUserSavingsTrendCache(), &savingsTrendGroup, cacheKey, func() (SavingsTrend, error) {
		trend, err := buildUserSavingsTrend(setting, userId, startTimestamp, endTimestamp, granularity, utcOffsetMinutes)
		if err != nil {
			return SavingsTrend{}, err
		}
		return *trend, nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func buildUserSavingsTrend(setting savings_setting.Setting, userId int, startTimestamp int64, endTimestamp int64, granularity string, utcOffsetMinutes int) (*SavingsTrend, error) {
	summary := newSavingsSummary(setting, startTimestamp, endTimestamp)
	buckets, bucketSize, err := buildSavingsTrendBuckets(startTimestamp, endTimestamp, granularity, utcOffsetMinutes)
	if err != nil {
		return nil, err
	}
	trend := &SavingsTrend{
		Granularity:      granularity,
		UTCOffsetMinutes: utcOffsetMinutes,
		StartTimestamp:   startTimestamp,
		EndTimestamp:     endTimestamp,
		Summary:          *summary,
		Buckets:          buckets,
	}
	if !summary.Enabled {
		return trend, nil
	}

	rows, total, partial, err := loadUserSavingsRows(userId, startTimestamp, endTimestamp)
	if err != nil {
		return nil, err
	}
	summary.RequestCount = total
	if partial {
		summary.IsPartial = true
		trend.Summary = *summary
		trend.Buckets = []SavingsTrendBucket{}
		return trend, nil
	}
	if total == 0 {
		trend.Summary = *summary
		return trend, nil
	}

	estimator := newSavingsLogEstimator(setting)
	accumulator := newSavingsSummaryAccumulator(summary, estimator.priceSnapshotAt, setting.OfficialPriceStaleDays)
	firstBucketStart := buckets[0].StartTimestamp
	for _, row := range rows {
		bucketIndex := int((row.CreatedAt - firstBucketStart) / bucketSize)
		if bucketIndex < 0 || bucketIndex >= len(buckets) {
			continue
		}
		bucket := &buckets[bucketIndex]
		bucket.RequestCount++

		result := estimator.estimate(row)
		if result.Estimate == nil {
			continue
		}
		if err := accumulator.add(result); err != nil {
			return nil, err
		}
		if err := addSavingsTrendBucket(bucket, result); err != nil {
			return nil, err
		}
	}
	accumulator.finish()
	for i := range buckets {
		if buckets[i].RequestCount > 0 {
			buckets[i].CoverageRatio = float64(buckets[i].EstimatedRequestCount) / float64(buckets[i].RequestCount)
		}
	}
	trend.Summary = *summary
	trend.Buckets = buckets
	return trend, nil
}

func getUserSavingsSummaryCache() *cachex.HybridCache[SavingsSummary] {
	savingsSummaryCacheOnce.Do(func() {
		savingsSummaryCache = cachex.NewHybridCache[SavingsSummary](cachex.HybridCacheConfig[SavingsSummary]{
			Namespace: cachex.Namespace(savingsSummaryCacheNS),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[SavingsSummary]{},
			Memory: func() *hot.HotCache[string, SavingsSummary] {
				return hot.NewHotCache[string, SavingsSummary](hot.LRU, savingsResultCacheCapacity).
					WithTTL(savingsResultCacheTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return savingsSummaryCache
}

func getUserSavingsTrendCache() *cachex.HybridCache[SavingsTrend] {
	savingsTrendCacheOnce.Do(func() {
		savingsTrendCache = cachex.NewHybridCache[SavingsTrend](cachex.HybridCacheConfig[SavingsTrend]{
			Namespace: cachex.Namespace(savingsTrendCacheNS),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[SavingsTrend]{},
			Memory: func() *hot.HotCache[string, SavingsTrend] {
				return hot.NewHotCache[string, SavingsTrend](hot.LRU, savingsResultCacheCapacity).
					WithTTL(savingsResultCacheTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return savingsTrendCache
}

func loadCachedSavingsResult[V any](cache *cachex.HybridCache[V], group *singleflight.Group, key string, load func() (V, error)) (V, error) {
	if cached, found, err := cache.Get(key); err == nil && found {
		return cached, nil
	} else if err != nil {
		common.SysError("failed to read user savings cache: " + err.Error())
	}

	result, err, _ := group.Do(cache.FullKey(key), func() (interface{}, error) {
		loaded, loadErr := load()
		if loadErr != nil {
			return loaded, loadErr
		}
		if cacheErr := cache.SetWithTTL(key, loaded, savingsResultCacheTTL); cacheErr != nil {
			common.SysError("failed to write user savings cache: " + cacheErr.Error())
		}
		return loaded, nil
	})
	if err != nil {
		var zero V
		return zero, err
	}
	return result.(V), nil
}

func buildUserSavingsCacheKey(kind string, userId int, startTimestamp int64, endTimestamp int64, granularity string, utcOffsetMinutes int, setting savings_setting.Setting) (string, error) {
	settingJSON, err := common.Marshal(setting)
	if err != nil {
		return "", err
	}
	settingHash := sha256.Sum256(settingJSON)
	return fmt.Sprintf(
		"%s:%d:%d:%d:%d:%s:%d:%s",
		kind,
		savingsEstimateSchemaVersion,
		userId,
		startTimestamp,
		endTimestamp,
		granularity,
		utcOffsetMinutes,
		hex.EncodeToString(settingHash[:]),
	), nil
}

func newSavingsSummary(setting savings_setting.Setting, startTimestamp int64, endTimestamp int64) *SavingsSummary {
	return &SavingsSummary{
		Enabled:    setting.Enabled && setting.ShowOnDashboard,
		Source:     "official_snapshot",
		WindowDays: savingsWindowDays(startTimestamp, endTimestamp),
	}
}

func loadUserSavingsRows(userId int, startTimestamp int64, endTimestamp int64) ([]model.SavingsLogRow, int64, bool, error) {
	maxRows := savings_setting.MaxSummaryLogRows()
	total, err := model.CountUserSavingsConsumeLogs(userId, startTimestamp, endTimestamp)
	if err != nil {
		return nil, 0, false, err
	}
	if int64(maxRows) > 0 && total > int64(maxRows) {
		return nil, total, true, nil
	}
	if total == 0 {
		return []model.SavingsLogRow{}, 0, false, nil
	}
	rows, err := model.GetUserSavingsConsumeLogs(userId, startTimestamp, endTimestamp, maxRows)
	if err != nil {
		return nil, 0, false, err
	}
	return rows, total, false, nil
}

func newSavingsLogEstimator(setting savings_setting.Setting) savingsLogEstimator {
	priceSnapshotAt := time.Now().Unix()
	var localPrices map[string]savings_setting.OfficialPrice
	if setting.RebuildLegacyLogs {
		localPrices = buildLocalSavingsPriceMap(setting, priceSnapshotAt)
	}
	return savingsLogEstimator{
		setting:         setting,
		localPrices:     localPrices,
		priceSnapshotAt: priceSnapshotAt,
	}
}

func (e savingsLogEstimator) estimate(row model.SavingsLogRow) savingsLogEstimate {
	estimate, snapshotPresent := parseSavingsEstimateFromOther(row.Other)
	if snapshotPresent {
		if estimate == nil {
			return savingsLogEstimate{SkipReason: SavingsSkipInvalidSnapshot}
		}
		return savingsLogEstimate{Estimate: estimate, CalculationMode: savingsCalculationSnapshot}
	}
	if !e.setting.RebuildLegacyLogs {
		return savingsLogEstimate{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	result := rebuildHistoricalSavingsEstimate(e.setting, e.localPrices, row, e.priceSnapshotAt)
	return savingsLogEstimate{
		Estimate:        result.Estimate,
		CalculationMode: savingsCalculationHistorical,
		SkipReason:      result.SkipReason,
	}
}

func newSavingsSummaryAccumulator(summary *SavingsSummary, priceSnapshotAt int64, staleDays int) savingsSummaryAccumulator {
	return savingsSummaryAccumulator{
		summary:         summary,
		priceSnapshotAt: priceSnapshotAt,
		staleBefore:     time.Now().Add(-time.Duration(staleDays) * 24 * time.Hour).Unix(),
		sources:         make(map[string]struct{}, 2),
		allConfirmed:    true,
	}
}

func (a *savingsSummaryAccumulator) add(result savingsLogEstimate) error {
	if result.Estimate == nil {
		return nil
	}
	if !addSavingsSummaryQuota(&a.summary.OfficialQuota, result.Estimate.OfficialQuota) ||
		!addSavingsSummaryQuota(&a.summary.ActualQuota, result.Estimate.ActualQuota) ||
		!addSavingsSummaryQuota(&a.summary.SavingsQuota, result.Estimate.SavingsQuota) {
		return errors.New("user savings summary exceeds safe range")
	}
	a.summary.EstimatedRequestCount++
	if result.CalculationMode == savingsCalculationHistorical {
		a.summary.ReconstructedRequestCount++
	} else {
		a.summary.SnapshotRequestCount++
	}
	a.allConfirmed = a.allConfirmed && result.Estimate.OfficialConfirmed
	a.sources[savingsSummarySource(result.Estimate.Source)] = struct{}{}
	if result.Estimate.SourceUpdatedAt > 0 && (a.summary.SourceUpdatedAt == 0 || result.Estimate.SourceUpdatedAt < a.summary.SourceUpdatedAt) {
		a.summary.SourceUpdatedAt = result.Estimate.SourceUpdatedAt
	}
	if result.Estimate.SourceUpdatedAt > 0 && result.Estimate.SourceUpdatedAt < a.staleBefore {
		a.summary.OfficialPriceStale = true
	}
	return nil
}

func (a *savingsSummaryAccumulator) finish() {
	if a.summary.EstimatedRequestCount > 0 {
		a.summary.OfficialConfirmed = a.allConfirmed
	}
	if a.summary.ReconstructedRequestCount > 0 {
		a.summary.RebuildPriceSnapshotAt = a.priceSnapshotAt
	}
	if len(a.sources) == 1 {
		for source := range a.sources {
			a.summary.Source = source
		}
	} else if len(a.sources) > 1 {
		a.summary.Source = savingsSourceMixed
	}
	if a.summary.RequestCount > 0 {
		a.summary.CoverageRatio = float64(a.summary.EstimatedRequestCount) / float64(a.summary.RequestCount)
	}
}

func addSavingsTrendBucket(bucket *SavingsTrendBucket, result savingsLogEstimate) error {
	if result.Estimate == nil {
		return nil
	}
	if !addSavingsSummaryQuota(&bucket.OfficialQuota, result.Estimate.OfficialQuota) ||
		!addSavingsSummaryQuota(&bucket.ActualQuota, result.Estimate.ActualQuota) ||
		!addSavingsSummaryQuota(&bucket.SavingsQuota, result.Estimate.SavingsQuota) {
		return errors.New("user savings trend exceeds safe range")
	}
	bucket.EstimatedRequestCount++
	if result.CalculationMode == savingsCalculationHistorical {
		bucket.ReconstructedRequestCount++
	} else {
		bucket.SnapshotRequestCount++
	}
	return nil
}

func buildSavingsTrendBuckets(startTimestamp int64, endTimestamp int64, granularity string, utcOffsetMinutes int) ([]SavingsTrendBucket, int64, error) {
	if utcOffsetMinutes < -720 || utcOffsetMinutes > 840 {
		return nil, 0, ErrSavingsUTCOffsetInvalid
	}
	duration := endTimestamp - startTimestamp
	var bucketSize int64
	switch granularity {
	case SavingsTrendGranularityHour:
		bucketSize = 3600
		if duration > savingsTrendMaxHourSeconds {
			return nil, 0, ErrSavingsHourRangeTooLarge
		}
	case SavingsTrendGranularityDay:
		bucketSize = 24 * 3600
	default:
		return nil, 0, ErrSavingsGranularity
	}
	if duration <= 0 {
		return nil, 0, ErrSavingsTimeRangeInvalid
	}

	offsetSeconds := int64(utcOffsetMinutes) * 60
	firstBucketStart := ((startTimestamp + offsetSeconds) / bucketSize * bucketSize) - offsetSeconds
	bucketCount := int((endTimestamp - firstBucketStart + bucketSize - 1) / bucketSize)
	if bucketCount <= 0 || bucketCount > savingsTrendMaxBuckets {
		return nil, 0, ErrSavingsTooManyBuckets
	}
	buckets := make([]SavingsTrendBucket, bucketCount)
	for i := range buckets {
		bucketStart := firstBucketStart + int64(i)*bucketSize
		buckets[i] = SavingsTrendBucket{
			StartTimestamp: bucketStart,
			EndTimestamp:   bucketStart + bucketSize,
		}
	}
	return buckets, bucketSize, nil
}

func addSavingsSummaryQuota(total *int64, value int) bool {
	if value < 0 || *total > math.MaxInt64-int64(value) {
		return false
	}
	*total += int64(value)
	return true
}

func savingsSummarySource(source string) string {
	if source == savingsSourceLocalPricing {
		return savingsSourceLocalPricing
	}
	return savingsSourceOfficialOverride
}

func NormalizeSavingsSummaryWindow(startTimestamp int64, endTimestamp int64) (int64, error) {
	if startTimestamp <= 0 || endTimestamp <= 0 {
		return 0, ErrSavingsTimeRangeRequired
	}
	now := time.Now().Unix()
	if endTimestamp > now+5*60 {
		return 0, ErrSavingsEndAfterNow
	}
	if endTimestamp > now {
		endTimestamp = now
	}
	if endTimestamp <= startTimestamp {
		return 0, ErrSavingsTimeRangeInvalid
	}
	maxDays := savings_setting.MaxSummaryDays()
	if maxDays > 0 && endTimestamp-startTimestamp > int64(maxDays)*24*3600 {
		return 0, ErrSavingsTimeRangeTooLarge
	}
	return endTimestamp, nil
}

func NormalizeSavingsTrendWindow(startTimestamp int64, endTimestamp int64, granularity string, utcOffsetMinutes int) (int64, error) {
	effectiveEndTimestamp, err := NormalizeSavingsSummaryWindow(startTimestamp, endTimestamp)
	if err != nil {
		return 0, err
	}
	if _, _, err := buildSavingsTrendBuckets(startTimestamp, effectiveEndTimestamp, granularity, utcOffsetMinutes); err != nil {
		return 0, err
	}
	return effectiveEndTimestamp, nil
}

func ValidateSavingsSummaryWindow(startTimestamp int64, endTimestamp int64) error {
	_, err := NormalizeSavingsSummaryWindow(startTimestamp, endTimestamp)
	return err
}

func savingsEstimateFromOther(other string) *SavingsEstimate {
	estimate, _ := parseSavingsEstimateFromOther(other)
	return estimate
}

func parseSavingsEstimateFromOther(other string) (*SavingsEstimate, bool) {
	if strings.TrimSpace(other) == "" {
		return nil, false
	}
	var parsed savingsLogOther
	if err := common.UnmarshalJsonStr(other, &parsed); err != nil {
		return nil, false
	}
	if len(parsed.SavingsEstimate) == 0 {
		return nil, false
	}
	var estimate SavingsEstimate
	if err := common.Unmarshal(parsed.SavingsEstimate, &estimate); err != nil {
		return nil, true
	}
	if estimate.SchemaVersion != savingsEstimateSchemaVersion {
		return nil, true
	}
	if estimate.OfficialQuota < 0 || estimate.ActualQuota < 0 || estimate.SavingsQuota < 0 {
		return nil, true
	}
	expectedSavings := estimate.OfficialQuota - estimate.ActualQuota
	if expectedSavings < 0 {
		expectedSavings = 0
	}
	if estimate.SavingsQuota != expectedSavings {
		return nil, true
	}
	if estimate.CalculationMode == "" {
		estimate.CalculationMode = savingsCalculationSnapshot
	}
	return &estimate, true
}

func matchSavingsOfficialPrice(setting savings_setting.Setting, relayInfo *relaycommon.RelayInfo, modelName string) (savings_setting.OfficialPrice, string, string) {
	return matchSavingsOfficialPriceCandidates(setting, savingsModelCandidates(relayInfo, modelName), nil, time.Now().Unix())
}

func matchSavingsOfficialPriceCandidates(setting savings_setting.Setting, candidates []string, localPrices map[string]savings_setting.OfficialPrice, priceSnapshotAt int64) (savings_setting.OfficialPrice, string, string) {
	foundUnconfirmed := false
	for _, candidate := range candidates {
		price, ok := setting.OfficialPrices[candidate]
		if !ok {
			continue
		}
		if setting.RequireOfficialConfirmation && !price.OfficialConfirmed {
			foundUnconfirmed = true
			continue
		}
		if strings.TrimSpace(price.Source) == "" {
			price.Source = savingsSourceOfficialOverride
		}
		price.PriceSnapshotAt = priceSnapshotAt
		if !finalizeSavingsOfficialPrice(&price, candidate) {
			return price, candidate, SavingsSkipInvalidSnapshot
		}
		return price, candidate, ""
	}
	if setting.LocalPricingOfficialConfirmed {
		for _, candidate := range candidates {
			var price savings_setting.OfficialPrice
			var ok bool
			if localPrices == nil {
				localPricing, found := model.GetPricingByModel(candidate)
				if !found {
					continue
				}
				price = savingsOfficialPriceFromPricing(localPricing, priceSnapshotAt)
			} else {
				price, ok = localPrices[candidate]
				if !ok {
					continue
				}
			}
			if !finalizeSavingsOfficialPrice(&price, candidate) {
				return price, candidate, SavingsSkipInvalidSnapshot
			}
			return price, candidate, ""
		}
	}
	if foundUnconfirmed {
		return savings_setting.OfficialPrice{}, "", SavingsSkipUnconfirmedOfficialPrice
	}
	return savings_setting.OfficialPrice{}, "", SavingsSkipMissingOfficialPrice
}

func buildLocalSavingsPriceMap(setting savings_setting.Setting, priceSnapshotAt int64) map[string]savings_setting.OfficialPrice {
	prices := make(map[string]savings_setting.OfficialPrice)
	if !setting.LocalPricingOfficialConfirmed {
		return prices
	}
	for _, pricing := range model.GetPricing() {
		prices[pricing.ModelName] = savingsOfficialPriceFromPricing(pricing, priceSnapshotAt)
	}
	return prices
}

func savingsOfficialPriceFromPricing(pricing model.Pricing, priceSnapshotAt int64) savings_setting.OfficialPrice {
	price := savings_setting.OfficialPrice{
		QuotaType:            pricing.QuotaType,
		ModelRatio:           savingsFloat64Ptr(pricing.ModelRatio),
		ModelPrice:           savingsFloat64Ptr(pricing.ModelPrice),
		CompletionRatio:      savingsFloat64Ptr(pricing.CompletionRatio),
		CacheRatio:           pricing.CacheRatio,
		CreateCacheRatio:     pricing.CreateCacheRatio,
		ImageRatio:           pricing.ImageRatio,
		AudioRatio:           pricing.AudioRatio,
		AudioCompletionRatio: pricing.AudioCompletionRatio,
		BillingMode:          pricing.BillingMode,
		BillingExpr:          pricing.BillingExpr,
		Source:               savingsSourceLocalPricing,
		PriceSnapshotAt:      priceSnapshotAt,
		OfficialConfirmed:    true,
	}
	return price
}

func finalizeSavingsOfficialPrice(price *savings_setting.OfficialPrice, matchedModel string) bool {
	fingerprint := savingsPriceFingerprint{
		ModelName:            matchedModel,
		QuotaType:            price.QuotaType,
		ModelRatio:           price.ModelRatio,
		ModelPrice:           price.ModelPrice,
		CompletionRatio:      price.CompletionRatio,
		CacheRatio:           price.CacheRatio,
		CreateCacheRatio:     price.CreateCacheRatio,
		CacheCreation5mRatio: price.CacheCreation5mRatio,
		CacheCreation1hRatio: price.CacheCreation1hRatio,
		ImageRatio:           price.ImageRatio,
		AudioRatio:           price.AudioRatio,
		AudioCompletionRatio: price.AudioCompletionRatio,
		BillingMode:          price.BillingMode,
		BillingExpr:          price.BillingExpr,
	}
	data, err := common.Marshal(fingerprint)
	if err != nil {
		return false
	}
	hash := sha256.Sum256(data)
	price.PriceFingerprint = "sha256:" + hex.EncodeToString(hash[:])
	return true
}

func savingsFloat64Ptr(value float64) *float64 {
	return &value
}

func rebuildHistoricalSavingsEstimate(setting savings_setting.Setting, localPrices map[string]savings_setting.OfficialPrice, row model.SavingsLogRow, priceSnapshotAt int64) SavingsEstimateResult {
	if strings.TrimSpace(row.Other) == "" || row.PromptTokens < 0 || row.CompletionTokens < 0 || row.Quota < 0 {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	var legacy legacySavingsLogOther
	if err := common.UnmarshalJsonStr(row.Other, &legacy); err != nil {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	if legacy.GroupRatio == nil || legacy.CacheTokens == nil {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	if legacy.Audio || legacy.WSS || legacy.WebSearch || legacy.FileSearch ||
		legacy.AudioInputSeparatePrice || legacy.ImageGenerationCall {
		return SavingsEstimateResult{SkipReason: SavingsSkipUnsupportedBillingMode}
	}
	mode := strings.TrimSpace(legacy.BillingMode)
	if mode == "" {
		mode = billing_setting.BillingModeRatio
	}
	if mode != billing_setting.BillingModeRatio && mode != "per_token" && mode != billing_setting.BillingModeTieredExpr {
		return SavingsEstimateResult{SkipReason: SavingsSkipUnsupportedBillingMode}
	}
	if *legacy.CacheTokens < 0 || legacy.CacheCreationTokens < 0 || legacy.CacheCreationTokens5m < 0 || legacy.CacheCreationTokens1h < 0 {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	if legacy.UsageSemantic != "" && legacy.UsageSemantic != "openai" && legacy.UsageSemantic != "anthropic" {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	isClaudeUsage := legacy.UsageSemantic == "anthropic" || legacy.Claude
	if !isClaudeUsage && (legacy.CacheCreationTokens5m > 0 || legacy.CacheCreationTokens1h > 0) {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}
	imageTokens := 0
	if legacy.Image {
		if legacy.ImageOutput == nil || *legacy.ImageOutput < 0 {
			return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
		}
		imageTokens = *legacy.ImageOutput
	} else if legacy.ImageOutput != nil && *legacy.ImageOutput != 0 {
		return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
	}

	summary := textQuotaSummary{
		PromptTokens:          row.PromptTokens,
		CompletionTokens:      row.CompletionTokens,
		TotalTokens:           row.PromptTokens + row.CompletionTokens,
		CacheTokens:           *legacy.CacheTokens,
		CacheCreationTokens:   legacy.CacheCreationTokens,
		CacheCreationTokens5m: legacy.CacheCreationTokens5m,
		CacheCreationTokens1h: legacy.CacheCreationTokens1h,
		ImageTokens:           imageTokens,
		ModelName:             row.ModelName,
		Quota:                 row.Quota,
		IsClaudeUsageSemantic: isClaudeUsage,
		UsageSemantic:         legacy.UsageSemantic,
	}
	if summary.TotalTokens <= 0 {
		return SavingsEstimateResult{SkipReason: SavingsSkipMissingUsage}
	}
	actualQuota := row.Quota
	if mode == billing_setting.BillingModeTieredExpr {
		exprBytes, err := base64.StdEncoding.DecodeString(legacy.ExprB64)
		if err != nil || len(exprBytes) == 0 {
			return SavingsEstimateResult{SkipReason: SavingsSkipLegacyInvalidSnapshot}
		}
		rebuiltQuota, skipReason := calculateSavingsTieredTextQuota(summary, string(exprBytes), *legacy.GroupRatio)
		if skipReason != "" {
			return SavingsEstimateResult{SkipReason: skipReason}
		}
		if rebuiltQuota != row.Quota {
			return SavingsEstimateResult{SkipReason: SavingsSkipLegacyActualQuotaMismatch}
		}
	} else {
		if legacy.ModelRatio == nil || legacy.CompletionRatio == nil || legacy.ModelPrice == nil || legacy.CacheRatio == nil {
			return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
		}
		if *legacy.ModelPrice != 0 && *legacy.ModelPrice != -1 {
			return SavingsEstimateResult{SkipReason: SavingsSkipUnsupportedBillingMode}
		}
		if (legacy.CacheCreationTokens > 0 && legacy.CacheCreationRatio == nil) ||
			(legacy.CacheCreationTokens5m > 0 && legacy.CacheCreationRatio5m == nil) ||
			(legacy.CacheCreationTokens1h > 0 && legacy.CacheCreationRatio1h == nil) ||
			(legacy.Image && legacy.ImageRatio == nil) {
			return SavingsEstimateResult{SkipReason: SavingsSkipLegacyMissingBaseFields}
		}
		actualPrice := savings_setting.OfficialPrice{
			QuotaType:            0,
			ModelRatio:           legacy.ModelRatio,
			CompletionRatio:      legacy.CompletionRatio,
			CacheRatio:           legacy.CacheRatio,
			CreateCacheRatio:     legacy.CacheCreationRatio,
			CacheCreation5mRatio: legacy.CacheCreationRatio5m,
			CacheCreation1hRatio: legacy.CacheCreationRatio1h,
			ImageRatio:           legacy.ImageRatio,
			BillingMode:          billing_setting.BillingModeRatio,
		}
		rebuiltQuota, skipReason := calculateSavingsTextQuota(summary, actualPrice, *legacy.GroupRatio)
		if skipReason != "" {
			return SavingsEstimateResult{SkipReason: skipReason}
		}
		if rebuiltQuota != row.Quota {
			return SavingsEstimateResult{SkipReason: SavingsSkipLegacyActualQuotaMismatch}
		}
	}

	price, matchedModel, skipReason := matchSavingsOfficialPriceCandidates(
		setting,
		savingsModelCandidates(nil, row.ModelName),
		localPrices,
		priceSnapshotAt,
	)
	if skipReason != "" {
		return SavingsEstimateResult{SkipReason: skipReason}
	}
	officialQuota, skipReason := calculateOfficialTextQuota(summary, price)
	if skipReason != "" {
		return SavingsEstimateResult{SkipReason: skipReason}
	}
	savingsQuota := officialQuota - actualQuota
	if savingsQuota < 0 {
		savingsQuota = 0
	}
	return SavingsEstimateResult{Estimate: &SavingsEstimate{
		SchemaVersion:     savingsEstimateSchemaVersion,
		Calculator:        savingsHistoricalCalculator,
		OfficialQuota:     officialQuota,
		ActualQuota:       actualQuota,
		SavingsQuota:      savingsQuota,
		Source:            price.Source,
		SourceURL:         price.SourceURL,
		SourceUpdatedAt:   price.SourceUpdatedAt,
		PriceSnapshotAt:   price.PriceSnapshotAt,
		PriceFingerprint:  price.PriceFingerprint,
		OfficialConfirmed: price.OfficialConfirmed,
		MatchedModel:      matchedModel,
		PricingMode:       savingsPricingMode(price),
		CalculationMode:   savingsCalculationHistorical,
		Estimated:         true,
	}}
}

func savingsModelCandidates(relayInfo *relaycommon.RelayInfo, modelName string) []string {
	candidates := make([]string, 0, 6)
	add := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		for _, existing := range candidates {
			if existing == name {
				return
			}
		}
		candidates = append(candidates, name)
	}

	add(modelName)
	if relayInfo != nil {
		add(relayInfo.OriginModelName)
		if relayInfo.ChannelMeta != nil {
			add(relayInfo.ChannelMeta.UpstreamModelName)
		}
	}

	baseLen := len(candidates)
	for i := 0; i < baseLen; i++ {
		add(ratio_setting.FormatMatchingModelName(candidates[i]))
	}
	for _, candidate := range candidates {
		if strings.HasSuffix(candidate, ratio_setting.CompactModelSuffix) {
			add(ratio_setting.CompactWildcardModelKey)
			break
		}
	}
	return candidates
}

func calculateOfficialTextQuota(summary textQuotaSummary, price savings_setting.OfficialPrice) (int, string) {
	if strings.TrimSpace(price.BillingMode) == billing_setting.BillingModeTieredExpr {
		return calculateSavingsTieredTextQuota(summary, price.BillingExpr, 1)
	}
	return calculateSavingsTextQuota(summary, price, 1)
}

func savingsPricingMode(price savings_setting.OfficialPrice) string {
	if strings.TrimSpace(price.BillingMode) == billing_setting.BillingModeTieredExpr {
		return billing_setting.BillingModeTieredExpr
	}
	return "per_token"
}

func calculateSavingsTieredTextQuota(summary textQuotaSummary, expr string, groupRatio float64) (int, string) {
	expr = strings.TrimSpace(expr)
	// Request rules after ||| depend on headers, parameters, or time context that usage logs do not retain.
	if expr == "" || strings.Contains(expr, "|||") || !validSavingsRatio(groupRatio, true) {
		return 0, SavingsSkipUnsupportedBillingMode
	}
	usedVars := billingexpr.UsedVars(expr)
	if usedVars == nil {
		return 0, SavingsSkipInvalidSnapshot
	}
	for _, name := range []string{"header", "param", "has", "hour", "minute", "weekday", "month", "day", "img_o", "ao"} {
		if usedVars[name] {
			return 0, SavingsSkipUnsupportedBillingMode
		}
	}

	promptTokens := float64(summary.PromptTokens)
	completionTokens := float64(summary.CompletionTokens)
	cacheTokens := float64(summary.CacheTokens)
	cacheCreationTokens := float64(summary.CacheCreationTokens)
	cacheCreationTokens1h := float64(0)
	inputLength := promptTokens
	if summary.IsClaudeUsageSemantic {
		if summary.CacheCreationTokens5m > 0 || summary.CacheCreationTokens1h > 0 {
			cacheCreationTokens = float64(summary.CacheCreationTokens5m)
			cacheCreationTokens1h = float64(summary.CacheCreationTokens1h)
		}
		inputLength += cacheTokens + cacheCreationTokens + cacheCreationTokens1h
	} else {
		if usedVars["cr"] {
			promptTokens -= cacheTokens
		}
		if usedVars["cc"] {
			promptTokens -= cacheCreationTokens
		}
		if usedVars["img"] {
			promptTokens -= float64(summary.ImageTokens)
		}
		if usedVars["ai"] {
			promptTokens -= float64(summary.AudioTokens)
		}
	}
	if promptTokens < 0 {
		promptTokens = 0
	}
	if completionTokens < 0 {
		completionTokens = 0
	}

	snapshot := billingexpr.BillingSnapshot{
		BillingMode:  billing_setting.BillingModeTieredExpr,
		ExprString:   expr,
		ExprHash:     billingexpr.ExprHashString(expr),
		GroupRatio:   groupRatio,
		QuotaPerUnit: common.QuotaPerUnit,
		ExprVersion:  billingexpr.ExprVersion(expr),
	}
	result, err := billingexpr.ComputeTieredQuota(&snapshot, billingexpr.TokenParams{
		P:    promptTokens,
		C:    completionTokens,
		Len:  inputLength,
		CR:   cacheTokens,
		CC:   cacheCreationTokens,
		CC1h: cacheCreationTokens1h,
		Img:  float64(summary.ImageTokens),
		AI:   float64(summary.AudioTokens),
	})
	if err != nil || result.ActualQuotaAfterGroup < 0 {
		return 0, SavingsSkipInvalidSnapshot
	}
	if result.Clamp != nil {
		return 0, SavingsSkipQuotaSaturated
	}
	return result.ActualQuotaAfterGroup, ""
}

func calculateSavingsTextQuota(summary textQuotaSummary, price savings_setting.OfficialPrice, groupRatio float64) (int, string) {
	mode := strings.TrimSpace(price.BillingMode)
	if mode == "" {
		mode = billing_setting.BillingModeRatio
	}
	if price.QuotaType != 0 || (mode != billing_setting.BillingModeRatio && mode != "per_token") {
		return 0, SavingsSkipUnsupportedBillingMode
	}
	if price.ModelRatio == nil || price.CompletionRatio == nil ||
		!validSavingsRatio(*price.ModelRatio, false) ||
		!validSavingsRatio(*price.CompletionRatio, true) ||
		!validSavingsRatio(groupRatio, true) {
		return 0, SavingsSkipInvalidSnapshot
	}
	if summary.AudioTokens > 0 {
		return 0, SavingsSkipUnsupportedBillingMode
	}

	baseTokens := decimal.NewFromInt(int64(summary.PromptTokens))
	cacheQuota := decimal.Zero
	if summary.CacheTokens > 0 {
		cacheRatio := 1.0
		if price.CacheRatio != nil {
			if !validSavingsRatio(*price.CacheRatio, true) {
				return 0, SavingsSkipInvalidSnapshot
			}
			cacheRatio = *price.CacheRatio
		}
		if !summary.IsClaudeUsageSemantic && !summary.LegacyClaudeDerivedUsage {
			baseTokens = baseTokens.Sub(decimal.NewFromInt(int64(summary.CacheTokens)))
		}
		cacheQuota = decimal.NewFromInt(int64(summary.CacheTokens)).Mul(decimal.NewFromFloat(cacheRatio))
	}

	cacheCreateQuota, skipReason := calculateOfficialCacheCreateQuota(summary, price)
	if skipReason != "" {
		return 0, skipReason
	}

	imageQuota := decimal.Zero
	if summary.ImageTokens > 0 {
		imageRatio := 1.0
		if price.ImageRatio != nil {
			if !validSavingsRatio(*price.ImageRatio, true) {
				return 0, SavingsSkipInvalidSnapshot
			}
			imageRatio = *price.ImageRatio
		}
		baseTokens = baseTokens.Sub(decimal.NewFromInt(int64(summary.ImageTokens)))
		imageQuota = decimal.NewFromInt(int64(summary.ImageTokens)).Mul(decimal.NewFromFloat(imageRatio))
	}

	if baseTokens.IsNegative() {
		baseTokens = decimal.Zero
	}

	promptQuota := baseTokens.Add(cacheQuota).Add(cacheCreateQuota).Add(imageQuota)
	completionQuota := decimal.NewFromInt(int64(summary.CompletionTokens)).Mul(decimal.NewFromFloat(*price.CompletionRatio))
	quotaDecimal := promptQuota.Add(completionQuota).
		Mul(decimal.NewFromFloat(*price.ModelRatio)).
		Mul(decimal.NewFromFloat(groupRatio))
	if quotaDecimal.IsNegative() {
		return 0, SavingsSkipInvalidSnapshot
	}
	quota, clamp := common.QuotaFromDecimalChecked(quotaDecimal)
	if clamp != nil {
		return 0, SavingsSkipQuotaSaturated
	}
	if quota == 0 && summary.TotalTokens > 0 && *price.ModelRatio > 0 && groupRatio > 0 {
		quota = 1
	}
	return quota, ""
}

func calculateOfficialCacheCreateQuota(summary textQuotaSummary, price savings_setting.OfficialPrice) (decimal.Decimal, string) {
	cacheWriteTokens := summary.CacheCreationTokens
	hasSplitCacheCreationTokens := summary.CacheCreationTokens5m > 0 || summary.CacheCreationTokens1h > 0
	if cacheWriteTokens <= 0 && !hasSplitCacheCreationTokens {
		return decimal.Zero, ""
	}
	if !summary.IsClaudeUsageSemantic && !summary.LegacyClaudeDerivedUsage {
		if price.CreateCacheRatio == nil || !validSavingsRatio(*price.CreateCacheRatio, true) {
			return decimal.Zero, SavingsSkipInvalidSnapshot
		}
		return decimal.NewFromInt(int64(cacheWriteTokens)).Mul(decimal.NewFromFloat(*price.CreateCacheRatio)), ""
	}

	total := decimal.Zero
	remaining := cacheWriteTokens - summary.CacheCreationTokens5m - summary.CacheCreationTokens1h
	if remaining < 0 {
		remaining = 0
	}
	if remaining > 0 {
		if price.CreateCacheRatio == nil || !validSavingsRatio(*price.CreateCacheRatio, true) {
			return decimal.Zero, SavingsSkipInvalidSnapshot
		}
		total = total.Add(decimal.NewFromInt(int64(remaining)).Mul(decimal.NewFromFloat(*price.CreateCacheRatio)))
	}
	if summary.CacheCreationTokens5m > 0 {
		if price.CacheCreation5mRatio == nil || !validSavingsRatio(*price.CacheCreation5mRatio, true) {
			return decimal.Zero, SavingsSkipInvalidSnapshot
		}
		total = total.Add(decimal.NewFromInt(int64(summary.CacheCreationTokens5m)).Mul(decimal.NewFromFloat(*price.CacheCreation5mRatio)))
	}
	if summary.CacheCreationTokens1h > 0 {
		if price.CacheCreation1hRatio == nil || !validSavingsRatio(*price.CacheCreation1hRatio, true) {
			return decimal.Zero, SavingsSkipInvalidSnapshot
		}
		total = total.Add(decimal.NewFromInt(int64(summary.CacheCreationTokens1h)).Mul(decimal.NewFromFloat(*price.CacheCreation1hRatio)))
	}
	return total, ""
}

func hasSavingsUnsupportedTextExtra(relayInfo *relaycommon.RelayInfo, summary textQuotaSummary) bool {
	if relayInfo != nil && len(relayInfo.PriceData.OtherRatios()) > 0 {
		return true
	}
	return len(summary.ToolSurchargeItems) > 0 || summary.AudioInputPrice > 0
}

func validSavingsRatio(value float64, allowZero bool) bool {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return false
	}
	if allowZero {
		return value >= 0
	}
	return value > 0
}

func savingsWindowDays(startTimestamp int64, endTimestamp int64) int {
	if endTimestamp <= startTimestamp {
		return 0
	}
	return int((endTimestamp - startTimestamp + 24*3600 - 1) / (24 * 3600))
}
