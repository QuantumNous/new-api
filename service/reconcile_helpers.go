package service

import (
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// shanghaiLoc is the timezone supplier bills are anchored to (Asia/Shanghai).
// All hour-bucket math goes through this; we never assume the host runs in +8.
var shanghaiLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

// HourBucketOf maps a unix second to the "账单结束时间" integral hour, in unix
// seconds. The bucket owns the half-open interval [bucket - 3600, bucket):
//
//	2026-04-30 22:30:15 CST → 2026-04-30 23:00 CST
//	2026-04-30 23:30:00 CST → 2026-05-01 00:00 CST  (cross-month)
func HourBucketOf(unixSec int64) int64 {
	t := time.Unix(unixSec, 0).In(shanghaiLoc)
	start := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, shanghaiLoc)
	return start.Unix() + 3600
}

// DayBucketOf collapses a unix second (or, more usefully, an HourBucketOf
// result) to the "billing day" endpoint in Asia/Shanghai. Semantics mirror
// HourBucketOf: the bucket owns [bucket - 86400, bucket). A timestamp that
// already sits at the boundary (e.g. an hour_bucket of 2026-05-16 00:00,
// which represents the 2026-05-15 23:00–24:00 traffic) collapses to the
// day it actually belongs to (2026-05-16 00:00 = the 5-15 day-bucket).
func DayBucketOf(unixSec int64) int64 {
	// Subtract one second so boundary hour_buckets (HH:00:00 sharp) belong
	// to the previous day, matching the half-open interval convention.
	t := time.Unix(unixSec-1, 0).In(shanghaiLoc)
	next := time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, shanghaiLoc)
	return next.Unix()
}

// Granularity values accepted on the upload endpoint.
const (
	GranularityHour = "hour"
	GranularityDay  = "day"
)

// BucketOf picks the right bucketing function for the requested granularity.
// For day-level granularity we first hour-bucket (to settle cross-hour drift
// to the supplier's accounting boundary) then day-bucket.
func BucketOf(unixSec int64, granularity string) int64 {
	h := HourBucketOf(unixSec)
	if granularity == GranularityDay {
		return DayBucketOf(h)
	}
	return h
}

// LocalAggRow is one log decomposed into the supplier's token taxonomy.
// `IsCountBilling=true` rows carry a TokensCount=1 and zero the 4 text fields;
// other rows are the inverse.
type LocalAggRow struct {
	Model            string
	HourBucket       int64
	TokensInput      int64
	TokensOutput     int64
	TokensCacheRead  int64
	TokensCacheWrite int64
	TokensCount      int64
	AmountCNY        float64
	RequestCount     int
	IsCountBilling   bool
}

// extractTokenFields turns one consume Log into a single LocalAggRow.
//
// Classification (see docs/reconciliation-upload-design.md §3.3):
//   - count_billing == true → 计件 (count=1). Only this single flag is the
//     authoritative per-item marker — it's written by GenerateMjOtherInfo
//     and taskBillingOther for async tasks (MJ/视频/Suno) where the supplier
//     bills 1 unit per request. The `image` / `image_output` fields are NOT
//     reliable classifiers: PostTextConsumeQuota stamps `image=true` on
//     multimodal *text* chat (e.g. GPT-4V receiving image input) while
//     still recording prompt/completion tokens normally — treating those
//     as count-billed would silently drop all text token usage.
//   - else → 按比例文本: input/output/cache_read/cache_write
//
// Notes:
//   - When the channel uses model mapping, Log.ModelName is the user-facing
//     origin model; the supplier bill uses the upstream model name, which
//     log_info_generate / task_billing stash in Other.upstream_model_name.
//     Reconciling on the upstream name keeps mapped channels from showing
//     up as paired supplier_only / local_only rows.
//   - usage_semantic != "anthropic" (default OpenAI semantic): Log.PromptTokens
//     is the upstream raw value, which **includes both cache_read and
//     cache_write tokens** — service/text_quota.go's billing path subtracts
//     both when computing baseTokens, but the value stored on the Log row
//     is still the raw total. So here we subtract both to recover the pure
//     input count that matches the supplier's "输入" row. The condition
//     is >= (not >) so fully-cached requests (input == cache subtotal)
//     also drop to 0 instead of staying positive.
//   - cache_read comes from Other.cache_tokens (the cache *read* field, despite
//     the bare name — see service/log_info_generate.go).
//   - cache_write comes from Other.cache_write_tokens (preferred, written by
//     service/text_quota.go as the normalised 5m+1h total), falling back to
//     Other.cache_creation_tokens for Claude logs that pre-date the
//     normalised field.
//   - AmountCNY reconstructs the *upstream* cost in CNY by dividing out any
//     group / user-group ratio applied at billing time. Log.Quota is the
//     user-charged value; the supplier bill is the raw upstream cost. Without
//     this step, channels with non-default group ratios (enterprise discounts,
//     VIP markups, ...) would produce systematic amount diffs even when the
//     token usage matches the bill exactly.
func extractTokenFields(log model.Log) LocalAggRow {
	row := LocalAggRow{
		Model:        log.ModelName,
		HourBucket:   HourBucketOf(log.CreatedAt),
		RequestCount: 1,
	}

	var other map[string]interface{}
	if log.Other != "" {
		other, _ = common.StrToMap(log.Other)
	}

	if getBool(other, "is_model_mapped") {
		if up := strings.TrimSpace(getString(other, "upstream_model_name")); up != "" {
			row.Model = up
		}
	}

	row.AmountCNY = upstreamAmountCNY(log.Quota, other)

	if getBool(other, "count_billing") {
		row.IsCountBilling = true
		row.TokensCount = 1
		return row
	}

	cacheReadTokens := int64(getInt(other, "cache_tokens"))
	cacheWriteTokens := cacheWriteFromOther(other)

	inputTokens := int64(log.PromptTokens)
	isClaude := getString(other, "usage_semantic") == "anthropic"
	if !isClaude {
		if cacheReadTokens > 0 && inputTokens >= cacheReadTokens {
			inputTokens -= cacheReadTokens
		}
		if cacheWriteTokens > 0 && inputTokens >= cacheWriteTokens {
			inputTokens -= cacheWriteTokens
		}
	}

	row.TokensInput = inputTokens
	row.TokensOutput = int64(log.CompletionTokens)
	row.TokensCacheRead = cacheReadTokens
	row.TokensCacheWrite = cacheWriteTokens
	return row
}

// upstreamAmountCNY converts user-charged Log.Quota to the upstream CNY cost
// the supplier bill measures, dividing out the effective group ratio.
//
// Subtle detail (see relay/helper/price.go::HandleGroupRatio): when a user
// has a special-group ratio, the project records the SAME value in both
// `group_ratio` AND `user_group_ratio` in Log.Other, but quota was only
// multiplied by it ONCE. So we must only divide once — earlier versions
// divided by both and inflated the result by 1/special_ratio. The
// `group_ratio` field is always the effective ratio, so it's the only one
// we need to divide by here.
//
// A ratio recorded as 0 (or missing) means "no multiplier", equivalent
// to 1.0 — leave the quota alone.
func upstreamAmountCNY(quota int, other map[string]interface{}) float64 {
	if quota == 0 {
		return 0
	}
	upstreamQuota := float64(quota)
	if r := getFloat(other, "group_ratio"); r > 0 {
		upstreamQuota /= r
	}
	v := upstreamQuota / common.QuotaPerUnit * operation_setting.USDExchangeRate
	return math.Round(v*1e6) / 1e6
}

// cacheWriteFromOther mirrors the canonical formula used by
// service.cacheWriteTokensTotal / controller.otherCacheTokens: prefer the
// normalised `cache_write_tokens`; fall back to
// max(cache_creation_tokens, cache_creation_tokens_5m + cache_creation_tokens_1h)
// for legacy Claude/OpenRouter logs that didn't write the normalised field.
// Plain `cache_creation_tokens` alone is insufficient — some providers only
// emit the 5m/1h split fields without the aggregate.
func cacheWriteFromOther(other map[string]interface{}) int64 {
	if v := int64(getInt(other, "cache_write_tokens")); v > 0 {
		return v
	}
	creation := int64(getInt(other, "cache_creation_tokens"))
	split := int64(getInt(other, "cache_creation_tokens_5m") + getInt(other, "cache_creation_tokens_1h"))
	if split > creation {
		return split
	}
	return creation
}

// --- tiny JSON map readers (Log.Other is a map[string]interface{}) ---

func getInt(m map[string]interface{}, k string) int {
	if m == nil {
		return 0
	}
	switch v := m[k].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	}
	return 0
}

func getFloat(m map[string]interface{}, k string) float64 {
	if m == nil {
		return 0
	}
	switch v := m[k].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case int64:
		return float64(v)
	}
	return 0
}

func getString(m map[string]interface{}, k string) string {
	if m == nil {
		return ""
	}
	if s, ok := m[k].(string); ok {
		return s
	}
	return ""
}

func getBool(m map[string]interface{}, k string) bool {
	if m == nil {
		return false
	}
	if b, ok := m[k].(bool); ok {
		return b
	}
	return false
}
