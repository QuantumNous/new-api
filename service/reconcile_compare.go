package service

import (
	"fmt"
	"math"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// reconcileBucketKey is the join key for the two-sided fold: (model name,
// hour bucket end). Package-level so it's the same type everywhere it
// flows (anonymous structs are nominal in Go).
type reconcileBucketKey struct {
	model      string
	hourBucket int64
}

// normaliseGranularity returns the canonical granularity string for the
// requested value. Anything other than "day" falls back to "hour".
func normaliseGranularity(g string) string {
	if g == GranularityDay {
		return GranularityDay
	}
	return GranularityHour
}

// Compare runs the upload-driven reconciliation. It pulls our consumption
// logs for [channelIDs, time-range derived from supplierRows], folds both
// sides to (model, hour_bucket), produces per-row diffs, by-model totals,
// summary, and a drift verdict. See docs/reconciliation-upload-design.md.
func Compare(channelIDs []int, supplierRows []SupplierBillRow, parseErrs []ParseError, granularity string) (*dto.ReconcileResult, error) {
	if len(channelIDs) == 0 {
		return nil, fmt.Errorf("未选择 channel")
	}
	if len(supplierRows) == 0 {
		return nil, fmt.Errorf("账单解析后无任何有效行")
	}
	granularity = normaliseGranularity(granularity)

	// --- determine time range from supplier rows ---
	from, to := supplierRows[0].BucketStart, supplierRows[0].BucketEnd
	for _, r := range supplierRows[1:] {
		if r.BucketStart < from {
			from = r.BucketStart
		}
		if r.BucketEnd > to {
			to = r.BucketEnd
		}
	}
	if to-from > int64(common.ReconcileUploadMaxLogRangeDays)*86400 {
		return nil, fmt.Errorf("账单时间跨度 %d 天超出上限 %d 天，请按月切分",
			(to-from)/86400, common.ReconcileUploadMaxLogRangeDays)
	}

	// --- aggregate supplier side ---
	supAgg := map[reconcileBucketKey]*dto.DiffSide{}
	supRegions := map[reconcileBucketKey]map[string]struct{}{}

	for _, r := range supplierRows {
		bucket := r.BucketEnd
		if granularity == GranularityDay {
			bucket = DayBucketOf(bucket)
		}
		key := reconcileBucketKey{r.Model, bucket}
		side := supAgg[key]
		if side == nil {
			side = &dto.DiffSide{}
			supAgg[key] = side
			supRegions[key] = map[string]struct{}{}
		}
		switch r.TokenKind {
		case "input":
			side.TokensInput += r.Tokens
		case "output":
			side.TokensOutput += r.Tokens
		case "cache_read":
			side.TokensCacheRead += r.Tokens
		case "cache_write":
			side.TokensCacheWrite += r.Tokens
		case "count":
			side.TokensCount += r.Tokens
		case "unknown":
			// Unknown kinds still contribute to the amount but not to any
			// token bucket — surfaced separately in parse_errors for review.
		}
		side.AmountCNY += r.AmountCNY
		if r.Region != "" {
			supRegions[key][r.Region] = struct{}{}
		}
	}

	// --- aggregate local side ---
	locAgg, err := aggregateLocalLogs(channelIDs, from, to, granularity)
	if err != nil {
		return nil, fmt.Errorf("查询本地日志失败: %w", err)
	}

	// --- bucket-count guardrail: bail out before producing a giant payload ---
	totalBuckets := len(supAgg)
	for k := range locAgg {
		if _, ok := supAgg[k]; !ok {
			totalBuckets++
		}
	}
	if totalBuckets > common.ReconcileMaxBuckets {
		return nil, fmt.Errorf(
			"对账粒度 %s 下产生 %d 个 (模型, 时段) 桶，超过上限 %d。请切换到日级粒度，或缩短账单时间区间 / 减少 channel",
			granularity, totalBuckets, common.ReconcileMaxBuckets)
	}

	// --- merge keys & build diff rows ---
	allKeys := map[reconcileBucketKey]struct{}{}
	for k := range supAgg {
		allKeys[k] = struct{}{}
	}
	for k := range locAgg {
		allKeys[k] = struct{}{}
	}

	keyList := make([]reconcileBucketKey, 0, len(allKeys))
	for k := range allKeys {
		keyList = append(keyList, k)
	}
	sort.Slice(keyList, func(i, j int) bool {
		if keyList[i].hourBucket != keyList[j].hourBucket {
			return keyList[i].hourBucket < keyList[j].hourBucket
		}
		return keyList[i].model < keyList[j].model
	})

	// This full per-bucket trace feeds the drift analysis only; the detail
	// rows the UI shows come from alignAndExtractDiffs (v3.1). Single-side
	// counts for the summary are likewise taken from the aligned result.
	rows := make([]dto.ReconcileDiffRow, 0, len(keyList))
	var cumulativeDelta float64
	var maxAbsCumDelta float64

	for _, k := range keyList {
		sup := supAgg[k]
		loc := locAgg[k]

		status := "matched"
		if sup != nil && loc == nil {
			status = "supplier_only"
		} else if sup == nil && loc != nil {
			status = "local_only"
		}

		// delta = supplier - local
		delta := computeDelta(sup, loc)
		cumulativeDelta += delta.AmountCNY
		if abs := math.Abs(cumulativeDelta); abs > maxAbsCumDelta {
			maxAbsCumDelta = abs
		}

		var regions []string
		if reg, ok := supRegions[k]; ok && len(reg) > 0 {
			regions = make([]string, 0, len(reg))
			for r := range reg {
				regions = append(regions, r)
			}
			sort.Strings(regions)
		}

		rows = append(rows, dto.ReconcileDiffRow{
			HourBucket:               k.hourBucket,
			Model:                    k.model,
			Supplier:                 sup,
			Local:                    loc,
			Delta:                    delta,
			CumulativeDeltaAmountCNY: roundTo6(cumulativeDelta),
			Status:                   status,
			Regions:                  regions,
		})
	}

	// --- totals + summary ---
	var supTotal, locTotal dto.Totals
	for _, side := range supAgg {
		supTotal = addTotals(supTotal, sideToTotals(side))
	}
	for _, side := range locAgg {
		locTotal = addTotals(locTotal, sideToTotals(side))
	}
	totalDelta := dto.Totals{
		TokensInput:      supTotal.TokensInput - locTotal.TokensInput,
		TokensOutput:     supTotal.TokensOutput - locTotal.TokensOutput,
		TokensCacheRead:  supTotal.TokensCacheRead - locTotal.TokensCacheRead,
		TokensCacheWrite: supTotal.TokensCacheWrite - locTotal.TokensCacheWrite,
		TokensCount:      supTotal.TokensCount - locTotal.TokensCount,
		AmountCNY:        roundTo6(supTotal.AmountCNY - locTotal.AmountCNY),
	}
	var deltaPct float64
	if supTotal.AmountCNY != 0 {
		deltaPct = totalDelta.AmountCNY / supTotal.AmountCNY
	}

	// distinct models for summary
	distinctModels := map[string]struct{}{}
	for k := range allKeys {
		distinctModels[k.model] = struct{}{}
	}

	// --- by-model aggregation ---
	byModel := aggregateByModel(supAgg, locAgg)

	// --- drift analysis (over the FULL per-bucket trace, unchanged) ---
	drift := analyseDrift(rows, supTotal.AmountCNY, maxAbsCumDelta, cumulativeDelta)

	// --- v3.1: align drift away & keep only genuine difference rows ---
	// This does not touch supAgg/locAgg/byModel/summary totals — those stay
	// authoritative. It only replaces what the detail table shows.
	align := alignAndExtractDiffs(supAgg, locAgg, supRegions, granularity)
	for i := range byModel {
		byModel[i].DiffKind = align.modelDiffKind[byModel[i].Model]
	}
	diffBreakdown := buildDiffBreakdown(byModel, align.modelDiffKind)

	// --- build final result ---
	convertedErrs := make([]dto.ReconcileParseError, len(parseErrs))
	for i, e := range parseErrs {
		convertedErrs[i] = dto.ReconcileParseError{Row: e.Row, Reason: e.Reason}
	}

	result := &dto.ReconcileResult{
		Summary: dto.ReconcileSummary{
			From:             from,
			To:               to,
			ChannelIDs:       channelIDs,
			ModelsCount:      len(distinctModels),
			RowsCount:        len(align.rows),
			SupplierOnlyRows: align.supplierOnly,
			LocalOnlyRows:    align.localOnly,
			ParseErrorsCount: len(parseErrs),
			SupplierTotal:    roundTotals(supTotal),
			LocalTotal:       roundTotals(locTotal),
			Delta:            totalDelta,
			DeltaAmountPct:   deltaPct,
			DiffBreakdown:    diffBreakdown,
		},
		DriftAnalysis: drift,
		Rows:          align.rows,
		ByModel:       byModel,
		ParseErrors:   convertedErrs,
	}
	return result, nil
}

// aggregateLocalLogs streams consume + refund logs from LOG_DB and folds
// them to (model, time-bucket) in a single pass, so a month-long upload
// doesn't load millions of Log structs into memory. The hot state we keep
// is the per-bucket DiffSide map — tens of thousands of entries even on
// the largest workloads, ie a few MB at most.
//
// Refund logs (LogTypeRefund=6) are written by service/task_billing.go on
// async-task failure (MJ / 视频 / Suno). Treat them as negative consume:
// subtract their quota and token deltas from the bucket their origin log
// belonged to. The supplier likewise doesn't bill failed tasks, so this
// keeps `local_total` aligned with `supplier_total`. For pure text-chat
// channels (eg. parallel science maas) no refunds exist, so this branch
// is a no-op there.
func aggregateLocalLogs(channelIDs []int, from, to int64, granularity string) (map[reconcileBucketKey]*dto.DiffSide, error) {
	out := map[reconcileBucketKey]*dto.DiffSide{}

	rows, err := model.LOG_DB.Model(&model.Log{}).
		Where("type IN ? AND channel_id IN ? AND created_at >= ? AND created_at < ?",
			[]int{model.LogTypeConsume, model.LogTypeRefund}, channelIDs, from, to).
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var log model.Log
		if err := model.LOG_DB.ScanRows(rows, &log); err != nil {
			return nil, err
		}
		row := extractTokenFields(log)
		bucket := row.HourBucket
		if granularity == GranularityDay {
			bucket = DayBucketOf(bucket)
		}
		key := reconcileBucketKey{row.Model, bucket}
		side := out[key]
		if side == nil {
			side = &dto.DiffSide{}
			out[key] = side
		}

		sign := int64(1)
		amountSign := 1.0
		if log.Type == model.LogTypeRefund {
			sign = -1
			amountSign = -1.0
		}
		side.TokensInput += sign * row.TokensInput
		side.TokensOutput += sign * row.TokensOutput
		side.TokensCacheRead += sign * row.TokensCacheRead
		side.TokensCacheWrite += sign * row.TokensCacheWrite
		side.TokensCount += sign * row.TokensCount
		side.AmountCNY += amountSign * row.AmountCNY
		// RequestCount: only count consume requests; refunds shouldn't
		// increase the "request count" displayed in the UI.
		if log.Type != model.LogTypeRefund {
			side.RequestCount += row.RequestCount
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Round amounts at the bucket level once aggregation is done.
	for _, s := range out {
		s.AmountCNY = roundTo6(s.AmountCNY)
	}
	return out, nil
}

func computeDelta(sup, loc *dto.DiffSide) dto.Totals {
	if sup == nil {
		sup = &dto.DiffSide{}
	}
	if loc == nil {
		loc = &dto.DiffSide{}
	}
	return dto.Totals{
		TokensInput:      sup.TokensInput - loc.TokensInput,
		TokensOutput:     sup.TokensOutput - loc.TokensOutput,
		TokensCacheRead:  sup.TokensCacheRead - loc.TokensCacheRead,
		TokensCacheWrite: sup.TokensCacheWrite - loc.TokensCacheWrite,
		TokensCount:      sup.TokensCount - loc.TokensCount,
		AmountCNY:        roundTo6(sup.AmountCNY - loc.AmountCNY),
	}
}

func sideToTotals(s *dto.DiffSide) dto.Totals {
	if s == nil {
		return dto.Totals{}
	}
	return dto.Totals{
		TokensInput:      s.TokensInput,
		TokensOutput:     s.TokensOutput,
		TokensCacheRead:  s.TokensCacheRead,
		TokensCacheWrite: s.TokensCacheWrite,
		TokensCount:      s.TokensCount,
		AmountCNY:        s.AmountCNY,
	}
}

func addTotals(a, b dto.Totals) dto.Totals {
	return dto.Totals{
		TokensInput:      a.TokensInput + b.TokensInput,
		TokensOutput:     a.TokensOutput + b.TokensOutput,
		TokensCacheRead:  a.TokensCacheRead + b.TokensCacheRead,
		TokensCacheWrite: a.TokensCacheWrite + b.TokensCacheWrite,
		TokensCount:      a.TokensCount + b.TokensCount,
		AmountCNY:        a.AmountCNY + b.AmountCNY,
	}
}

func roundTotals(t dto.Totals) dto.Totals {
	t.AmountCNY = roundTo6(t.AmountCNY)
	return t
}

func roundTo6(v float64) float64 {
	return math.Round(v*1e6) / 1e6
}

func aggregateByModel(
	supAgg, locAgg map[reconcileBucketKey]*dto.DiffSide,
) []dto.ByModelStat {
	type modelTotals struct {
		sup, loc dto.DiffSide
	}
	per := map[string]*modelTotals{}
	add := func(m string, sup, loc *dto.DiffSide) {
		p := per[m]
		if p == nil {
			p = &modelTotals{}
			per[m] = p
		}
		if sup != nil {
			p.sup.TokensInput += sup.TokensInput
			p.sup.TokensOutput += sup.TokensOutput
			p.sup.TokensCacheRead += sup.TokensCacheRead
			p.sup.TokensCacheWrite += sup.TokensCacheWrite
			p.sup.TokensCount += sup.TokensCount
			p.sup.AmountCNY += sup.AmountCNY
		}
		if loc != nil {
			p.loc.TokensInput += loc.TokensInput
			p.loc.TokensOutput += loc.TokensOutput
			p.loc.TokensCacheRead += loc.TokensCacheRead
			p.loc.TokensCacheWrite += loc.TokensCacheWrite
			p.loc.TokensCount += loc.TokensCount
			p.loc.AmountCNY += loc.AmountCNY
		}
	}
	for k, sup := range supAgg {
		add(k.model, sup, nil)
	}
	for k, loc := range locAgg {
		add(k.model, nil, loc)
	}

	out := make([]dto.ByModelStat, 0, len(per))
	for m, t := range per {
		kinds := []dto.ByModelKind{
			makeKind("input", t.sup.TokensInput, t.loc.TokensInput),
			makeKind("output", t.sup.TokensOutput, t.loc.TokensOutput),
			makeKind("cache_read", t.sup.TokensCacheRead, t.loc.TokensCacheRead),
			makeKind("cache_write", t.sup.TokensCacheWrite, t.loc.TokensCacheWrite),
		}
		if t.sup.TokensCount > 0 || t.loc.TokensCount > 0 {
			kinds = append(kinds, makeKind("count", t.sup.TokensCount, t.loc.TokensCount))
		}
		out = append(out, dto.ByModelStat{
			Model:             m,
			Kinds:             kinds,
			SupplierAmountCNY: roundTo6(t.sup.AmountCNY),
			LocalAmountCNY:    roundTo6(t.loc.AmountCNY),
			DeltaAmountCNY:    roundTo6(t.sup.AmountCNY - t.loc.AmountCNY),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Model < out[j].Model })
	return out
}

func makeKind(kind string, sup, loc int64) dto.ByModelKind {
	delta := sup - loc
	var pct float64
	if sup != 0 {
		pct = float64(delta) / float64(sup)
	}
	return dto.ByModelKind{
		Kind:           kind,
		SupplierTokens: sup,
		LocalTokens:    loc,
		DeltaTokens:    delta,
		DeltaPct:       pct,
	}
}

// analyseDrift looks at the cumulative Δ¥ trace and decides whether the
// mismatch is normal hour-bucket drift (cancels out across the interval)
// or a real divergence (cumulative trace moves monotonically away from 0).
// Thresholds come from common/reconcile_constants.go.
func analyseDrift(rows []dto.ReconcileDiffRow, supplierTotal float64, maxAbsCum float64, finalCum float64) dto.ReconcileDriftAnalysis {
	drift := dto.ReconcileDriftAnalysis{
		MaxAbsCumulativeDelta: roundTo6(maxAbsCum),
		FinalCumulativeDelta:  roundTo6(finalCum),
	}
	if supplierTotal == 0 {
		drift.Verdict = "ok_drift_only"
		return drift
	}
	finalPct := math.Abs(finalCum / supplierTotal)
	if finalPct < common.ReconcileDriftOkPct {
		drift.Verdict = "ok_drift_only"
		return drift
	}
	if finalPct > common.ReconcileDriftWarnPct {
		drift.Verdict = "diverging"
		drift.DivergenceStartHour = findDivergenceStart(rows, supplierTotal)
		return drift
	}
	// Between the two thresholds → look for a monotonic streak as tie-breaker.
	if start, ok := monotonicStreakStart(rows, finalCum); ok {
		drift.Verdict = "diverging"
		drift.DivergenceStartHour = start
		return drift
	}
	drift.Verdict = "needs_attention"
	return drift
}

// findDivergenceStart returns the hour bucket where the cumulative Δ¥
// absolute value first exceeded 1% of the supplier total.
func findDivergenceStart(rows []dto.ReconcileDiffRow, supplierTotal float64) int64 {
	threshold := math.Abs(supplierTotal) * 0.01
	for _, r := range rows {
		if math.Abs(r.CumulativeDeltaAmountCNY) > threshold {
			return r.HourBucket
		}
	}
	if len(rows) > 0 {
		return rows[0].HourBucket
	}
	return 0
}

// monotonicStreakStart looks for ≥6 consecutive *time buckets* moving in the
// same direction as finalCum, totalling ≥80% of |finalCum|. Returns the
// streak's start bucket if such a streak exists.
//
// rows are (model, hour_bucket) tuples sorted by (HourBucket asc, Model asc),
// so a hot hour with many models could falsely satisfy a row-level "streak ≥ 6"
// even though only one hour passed. We therefore first fold rows into per-
// bucket deltas (summing across models in the same bucket), then look for a
// monotonic streak across those bucket-level deltas. Same loop works for
// day-level granularity — there's just one delta per "bucket" already.
func monotonicStreakStart(rows []dto.ReconcileDiffRow, finalCum float64) (int64, bool) {
	if len(rows) == 0 || finalCum == 0 {
		return 0, false
	}

	// Fold (model, bucket) rows → per-bucket aggregate delta. rows are
	// pre-sorted by HourBucket asc, so a single pass suffices.
	type bucketDelta struct {
		bucket int64
		sum    float64
	}
	var hourly []bucketDelta
	var curBucket int64
	var curSum float64
	started := false
	for _, r := range rows {
		if !started {
			curBucket = r.HourBucket
			curSum = r.Delta.AmountCNY
			started = true
			continue
		}
		if r.HourBucket == curBucket {
			curSum += r.Delta.AmountCNY
		} else {
			hourly = append(hourly, bucketDelta{curBucket, curSum})
			curBucket = r.HourBucket
			curSum = r.Delta.AmountCNY
		}
	}
	if started {
		hourly = append(hourly, bucketDelta{curBucket, curSum})
	}

	if len(hourly) < 6 {
		return 0, false
	}

	threshold := math.Abs(finalCum) * 0.8
	sign := 1.0
	if finalCum < 0 {
		sign = -1.0
	}
	var streak int
	var streakStart int64
	var streakSum float64
	for _, h := range hourly {
		if h.sum*sign > 0 {
			if streak == 0 {
				streakStart = h.bucket
				streakSum = 0
			}
			streak++
			streakSum += h.sum
			if streak >= 6 && math.Abs(streakSum) >= threshold {
				return streakStart, true
			}
		} else {
			streak = 0
			streakSum = 0
		}
	}
	return 0, false
}
