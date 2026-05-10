package service

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

var shanghaiLoc = func() *time.Location {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	return loc
}()

// HourBucketOf maps a unix second to the "account end time" integral hour unix second.
// Requests in [bucket-3600, bucket) belong to bucket.
func HourBucketOf(unixSec int64) int64 {
	t := time.Unix(unixSec, 0).In(shanghaiLoc)
	start := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, shanghaiLoc)
	return start.Unix() + 3600
}

type splitRow struct {
	TokenType string
	Tokens    int64
	Quota     int64
	Note      string
}

type accumulator struct {
	Tokens       int64
	Quota        int64
	RequestCount int
	// Notes is a set: only the keys are emitted (sorted, joined) by flattenBucket.
	// We never use occurrence counts, so a set is more honest than map[string]int.
	Notes map[string]struct{}
}

type bucketMap map[string]map[string]*accumulator // model -> token_type -> acc

func getOrInit(b bucketMap, modelName, tokenType string) *accumulator {
	if b[modelName] == nil {
		b[modelName] = make(map[string]*accumulator)
	}
	if b[modelName][tokenType] == nil {
		b[modelName][tokenType] = &accumulator{Notes: make(map[string]struct{})}
	}
	return b[modelName][tokenType]
}

// splitLogRows decomposes one consume Log into token-type rows per §4.3.
func splitLogRows(log model.Log) []splitRow {
	var other map[string]interface{}
	_ = common.UnmarshalJsonStr(log.Other, &other)

	// Category B: per-piece billing (MJ / video tasks / image generation).
	// Detection priority:
	//   1. explicit count_billing flag (set by GenerateMjOtherInfo and taskBillingOther)
	//   2. image=true (set by service/text_quota.go for image-bearing text requests)
	//   3. image_output > 0 (legacy fallback for older logs that predate count_billing)
	if getBool(other, "count_billing") || getBool(other, "image") ||
		getInt(other, "image_output") > 0 {
		return []splitRow{
			{TokenType: "count", Tokens: 1, Quota: int64(log.Quota)},
		}
	}

	// Category C edge-case notes
	var notes []string
	if getBool(other, "audio") {
		notes = append(notes, "audio")
	}
	if getBool(other, "ws") {
		notes = append(notes, "ws")
	}
	if n := getInt(other, "web_search_call_count"); n > 0 {
		notes = append(notes, fmt.Sprintf("web_search:%d", n))
	}
	if n := getInt(other, "file_search_call_count"); n > 0 {
		notes = append(notes, fmt.Sprintf("file_search:%d", n))
	}
	if getString(other, "billing_mode") == "tiered_expr" {
		notes = append(notes, "tiered_expr")
	}
	noteStr := strings.Join(notes, ",")

	// Category A / C: weight-based 4-row split
	cacheTokens := int64(getInt(other, "cache_tokens"))
	cacheRatio := getFloat(other, "cache_ratio")
	completionRatio := getFloat(other, "completion_ratio")
	if completionRatio == 0 {
		completionRatio = 1
	}

	// For OpenAI-compat usage_semantic, log.PromptTokens INCLUDES the cached
	// portion (the upstream payload reports total prompt tokens, with
	// cache_tokens being a subset). Billing's quota math subtracts it (see
	// service/text_quota.go:230-275 baseTokens = PromptTokens - cacheTokens),
	// but earlier versions of this aggregator used the raw PromptTokens as
	// the input weight. That double-counted the cached portion (once in the
	// input weight, once in the cached_input weight), inflating the input
	// row's share of Log.Quota at the expense of output, which broke
	// line-by-line comparison with the supplier bill (totals still matched
	// because Log.Quota itself is authoritative). For Claude semantics the
	// upstream already reports prompt and cache tokens separately, so
	// PromptTokens already excludes cached — no subtraction needed.
	isClaudeSemantic := getString(other, "usage_semantic") == "anthropic"
	baseInputTokens := int64(log.PromptTokens)
	if !isClaudeSemantic && cacheTokens > 0 && baseInputTokens > cacheTokens {
		baseInputTokens -= cacheTokens
	}

	weightInput := float64(baseInputTokens)
	weightCachedInput := float64(cacheTokens) * cacheRatio
	weightOutput := float64(log.CompletionTokens) * completionRatio
	weightTotal := weightInput + weightCachedInput + weightOutput

	var qIn, qCached, qOut int64
	if weightTotal <= 0 {
		qIn = int64(log.Quota)
	} else {
		qIn = int64(math.Round(float64(log.Quota) * weightInput / weightTotal))
		qCached = int64(math.Round(float64(log.Quota) * weightCachedInput / weightTotal))
		qOut = int64(log.Quota) - qIn - qCached
	}

	// Skip cached_input / cached_storage rows when there are no cache tokens —
	// avoids writing two zero rows per request for the common no-cache case.
	// Their quota is 0 anyway (qCached == 0 when cacheTokens == 0), so the
	// ∑rows.quota === log.Quota invariant is preserved by input + output alone.
	rows := []splitRow{
		{TokenType: "input", Tokens: baseInputTokens, Quota: qIn, Note: noteStr},
	}
	if cacheTokens > 0 {
		rows = append(rows,
			splitRow{TokenType: "cached_input", Tokens: cacheTokens, Quota: qCached, Note: noteStr},
			splitRow{TokenType: "cached_storage", Tokens: cacheTokens, Quota: 0, Note: noteStr},
		)
	}
	rows = append(rows,
		splitRow{TokenType: "output", Tokens: int64(log.CompletionTokens), Quota: qOut, Note: noteStr},
	)
	return rows
}

func aggregateOneHour(channelId int, hourBucket int64) error {
	rangeStart := hourBucket - 3600
	rangeEnd := hourBucket

	var consumeLogs []model.Log
	if err := model.LOG_DB.Where(
		"type = ? AND channel_id = ? AND created_at >= ? AND created_at < ?",
		model.LogTypeConsume, channelId, rangeStart, rangeEnd,
	).Find(&consumeLogs).Error; err != nil {
		return fmt.Errorf("fetch consume logs: %w", err)
	}

	refundLogs := findRefundsForBucket(channelId, hourBucket)

	bucket := make(bucketMap)
	var sumQuotaInLogs int64

	for _, log := range consumeLogs {
		rows := splitLogRows(log)
		for _, r := range rows {
			acc := getOrInit(bucket, log.ModelName, r.TokenType)
			acc.Tokens += r.Tokens
			acc.Quota += r.Quota
			acc.RequestCount++
			if r.Note != "" {
				acc.Notes[r.Note] = struct{}{}
			}
		}
		sumQuotaInLogs += int64(log.Quota)
	}

	for _, refund := range refundLogs {
		applyRefund(bucket, refund)
		sumQuotaInLogs -= int64(refund.Quota)
	}

	// Sanity check: ∑bucket.quota must equal ∑log.quota (signed)
	var sumQuotaInBucket int64
	for _, m := range bucket {
		for _, acc := range m {
			sumQuotaInBucket += acc.Quota
		}
	}
	if sumQuotaInBucket != sumQuotaInLogs {
		return fmt.Errorf("aggregator quota mismatch hour=%d channel=%d sumLogs=%d sumBucket=%d",
			hourBucket, channelId, sumQuotaInLogs, sumQuotaInBucket)
	}

	// Get previous version before transaction
	prevAggAt, prevVersion, _ := model.GetReconcileHourlyAggregateInfo(channelId, hourBucket)
	_ = prevAggAt
	nextVersion := prevVersion + 1

	now := time.Now().Unix()
	return model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("hour_bucket = ? AND channel_id = ?", hourBucket, channelId).
			Delete(&model.ReconcileHourly{}).Error; err != nil {
			return err
		}
		rows := flattenBucket(bucket, hourBucket, channelId, now, nextVersion)
		if len(rows) == 0 {
			return nil
		}
		return tx.CreateInBatches(rows, 200).Error
	})
}

func findRefundsForBucket(channelId int, hourBucket int64) []model.Log {
	var refunds []model.Log
	// Find refund logs whose origin consume log falls in [hourBucket-3600, hourBucket)
	if err := model.LOG_DB.Raw(`
		SELECT r.* FROM logs r
		INNER JOIN logs origin ON origin.request_id = r.request_id AND origin.type = ?
		WHERE r.type = ? AND r.channel_id = ?
		  AND origin.created_at >= ? AND origin.created_at < ?`,
		model.LogTypeConsume, model.LogTypeRefund, channelId,
		hourBucket-3600, hourBucket,
	).Scan(&refunds).Error; err != nil {
		common.SysLog(fmt.Sprintf("WARN findRefundsForBucket channel=%d bucket=%d: %v", channelId, hourBucket, err))
	}
	return refunds
}

func applyRefund(bucket bucketMap, refundLog model.Log) {
	var origin model.Log
	err := model.LOG_DB.Where("type = ? AND request_id = ?",
		model.LogTypeConsume, refundLog.RequestId).First(&origin).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("WARN refund without origin: refund_log_id=%d request_id=%s",
			refundLog.Id, refundLog.RequestId))
		origin = refundLog
	}
	rows := splitLogRows(origin)
	if len(rows) == 0 {
		return
	}
	scale := 1.0
	if origin.Quota > 0 {
		scale = float64(refundLog.Quota) / float64(origin.Quota)
	}
	// Quota and Tokens are deducted per-row using math.Round, but the last
	// row absorbs the rounding remainder so the totals match the refund
	// quota exactly. Without this, sumQuotaInBucket != sumQuotaInLogs and
	// the sanity check in aggregateOneHour rolls back the entire bucket
	// transaction whenever a partial refund cannot be evenly distributed.
	targetQuota := int64(refundLog.Quota)
	var originTokenSum int64
	for _, r := range rows {
		originTokenSum += r.Tokens
	}
	targetTokens := int64(math.Round(float64(originTokenSum) * scale))

	var deductedQuota, deductedTokens int64
	for i, r := range rows {
		var dQ, dT int64
		if i < len(rows)-1 {
			dQ = int64(math.Round(float64(r.Quota) * scale))
			dT = int64(math.Round(float64(r.Tokens) * scale))
		} else {
			dQ = targetQuota - deductedQuota
			dT = targetTokens - deductedTokens
		}
		deductedQuota += dQ
		deductedTokens += dT
		acc := getOrInit(bucket, origin.ModelName, r.TokenType)
		acc.Tokens -= dT
		acc.Quota -= dQ
		// RequestCount not decremented per design §4.6
	}
}

func flattenBucket(bucket bucketMap, hourBucket int64, channelId int, now int64, version int) []*model.ReconcileHourly {
	var rows []*model.ReconcileHourly
	for modelName, types := range bucket {
		for tokenType, acc := range types {
			amtCny := math.Round(float64(acc.Quota)/float64(common.QuotaPerUnit)*operation_setting.USDExchangeRate*1e6) / 1e6

			noteKeys := make([]string, 0, len(acc.Notes))
			for n := range acc.Notes {
				noteKeys = append(noteKeys, n)
			}
			// sort to keep output deterministic across reaggregations —
			// Go map iteration is randomized and would otherwise produce
			// different join orders for the same input.
			sort.Strings(noteKeys)

			rows = append(rows, &model.ReconcileHourly{
				HourBucket:   hourBucket,
				ChannelId:    channelId,
				ModelName:    modelName,
				TokenType:    tokenType,
				Tokens:       acc.Tokens,
				Quota:        acc.Quota,
				AmountCny:    amtCny,
				RequestCount: acc.RequestCount,
				Note:         strings.Join(noteKeys, ","),
				AggregatedAt: now,
				Version:      version,
			})
		}
	}
	return rows
}

// AggregateRange aggregates all hour buckets in [from, to] for the given
// channel. Returns the number of buckets that aggregated cleanly, the number
// that failed (already SysLogged), and an outer error for argument problems
// (per-bucket failures do NOT bubble up — callers should report `failed`).
func AggregateRange(channelId int, from, to int64) (processed, failed int, err error) {
	if from > to {
		return 0, 0, fmt.Errorf("from > to")
	}
	firstBucket := HourBucketOf(from)
	lastBucket := HourBucketOf(to)
	for bucket := firstBucket; bucket <= lastBucket; bucket += 3600 {
		if e := aggregateOneHour(channelId, bucket); e != nil {
			common.SysLog(fmt.Sprintf("ERROR aggregateOneHour channel=%d bucket=%d: %v", channelId, bucket, e))
			failed++
			continue
		}
		processed++
	}
	return processed, failed, nil
}

// RunReconcileAggregation runs one full sweep of [now-25h, now-2h] for all channels.
func RunReconcileAggregation() {
	now := time.Now().Unix()
	windowStart := now - 25*3600
	windowEnd := now - 2*3600

	var channelIds []int
	if err := model.DB.Table("channels").Where("status = 1 AND need_reconcile = 1").Pluck("id", &channelIds).Error; err != nil {
		common.SysLog("ERROR reconcile: fetch channel ids: " + err.Error())
		return
	}

	// Find refund-affected buckets (origin outside window but refund within window)
	type extraBucket struct {
		OriginCreatedAt int64
		ChannelId       int
	}
	var extras []extraBucket
	model.LOG_DB.Raw(`
		SELECT DISTINCT origin.created_at AS origin_created_at, r.channel_id
		FROM logs r
		LEFT JOIN logs origin ON origin.request_id = r.request_id AND origin.type = ?
		WHERE r.type = ? AND r.created_at >= ? AND r.created_at < ?`,
		model.LogTypeConsume, model.LogTypeRefund, windowStart, windowEnd,
	).Scan(&extras)

	type cbKey struct {
		channelId  int
		hourBucket int64
	}
	toProcess := make(map[cbKey]bool)

	firstWindowBucket := HourBucketOf(windowStart)
	lastWindowBucket := HourBucketOf(windowEnd)
	for _, cid := range channelIds {
		for bucket := firstWindowBucket; bucket <= lastWindowBucket; bucket += 3600 {
			toProcess[cbKey{cid, bucket}] = true
		}
	}

	sevenDaysAgo := now - 7*86400
	for _, eb := range extras {
		if eb.OriginCreatedAt == 0 {
			continue
		}
		bucket := HourBucketOf(eb.OriginCreatedAt)
		if bucket < sevenDaysAgo {
			common.SysLog(fmt.Sprintf("WARN refund too late, skipping rebucket: channel=%d originBucket=%d", eb.ChannelId, bucket))
			continue
		}
		toProcess[cbKey{eb.ChannelId, bucket}] = true
	}

	lag := int64(common.ReconcileAggregateLagSeconds)
	processed := 0
	for key := range toProcess {
		aggAt, _, err := model.GetReconcileHourlyAggregateInfo(key.channelId, key.hourBucket)
		if err != nil {
			common.SysLog(fmt.Sprintf("WARN reconcile agg info channel=%d bucket=%d: %v", key.channelId, key.hourBucket, err))
		}
		if aggAt > key.hourBucket+lag {
			continue
		}
		if err := aggregateOneHour(key.channelId, key.hourBucket); err != nil {
			common.SysLog(fmt.Sprintf("ERROR reconcile channel=%d bucket=%d: %v", key.channelId, key.hourBucket, err))
			continue
		}
		processed++
	}

	common.SysLog(fmt.Sprintf("reconcile aggregator: tick done, processed %d hour-buckets", processed))
}

// --- helpers for reading Log.Other ---

func getBool(m map[string]interface{}, key string) bool {
	if m == nil {
		return false
	}
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

func getInt(m map[string]interface{}, key string) int {
	if m == nil {
		return 0
	}
	v, ok := m[key]
	if !ok {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case int64:
		return int(val)
	}
	return 0
}

func getFloat(m map[string]interface{}, key string) float64 {
	if m == nil {
		return 0
	}
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

func getString(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
