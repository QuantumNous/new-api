package service

import (
	"math"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// v3.1 difference localisation (docs/reconciliation-upload-design.md §十三).
//
// The supplier bills per hour and drifts each model's traffic by a systematic
// integer-hour offset (measured: supplier BucketEnd = our HourBucket + 1h on
// the dominant majority of buckets, with a little ±1h jitter on the rest). The
// old UI pushed a manual "明细合并" window selector onto the operator to soak
// that up. v3.1 does it automatically and only surfaces the buckets that carry
// a *genuine* residual Δ¥ — so the detail table answers "which hour, which
// usage dimension caused the total gap" without any knob.
//
// Pipeline per model:
//  1. probe shift ∈ [-N, +N] hours, pick the one minimising Σ|Δ¥| (ties → 0)
//  2. ±1h greedy opposite-sign netting on the aligned Δ¥ series (jitter)
//  3. keep buckets whose residual |Δ¥| ≥ threshold; classify each (diff_kind)
//
// This never mutates supAgg/locAgg, so summary / by_model stay authoritative.

const (
	diffKindMissingLocal    = "missing_local"    // supplier billed, we didn't record
	diffKindMissingSupplier = "missing_supplier" // we recorded, supplier didn't bill
	diffKindPriceOnly       = "price_only"       // same tokens/count, amount differs → ratio/price
	diffKindUsage           = "usage"            // token/count counts themselves differ
	diffKindMixed           = "mixed"            // model spans multiple kinds
)

// alignResult is what alignAndExtractDiffs hands back to Compare.
type alignResult struct {
	rows          []dto.ReconcileDiffRow
	supplierOnly  int
	localOnly     int
	modelDiffKind map[string]string // model → merged diff_kind (for by_model / breakdown)
}

// alignAndExtractDiffs runs the per-model align → net → filter → classify
// pipeline over the already-aggregated supplier and local sides.
func alignAndExtractDiffs(
	supAgg, locAgg map[reconcileBucketKey]*dto.DiffSide,
	supRegions map[reconcileBucketKey]map[string]struct{},
	granularity string,
) alignResult {
	step := int64(3600)
	maxShift := int64(common.ReconcileMaxAlignShiftHours)
	if granularity == GranularityDay {
		// Day buckets already subsume the ±1h offset; no sub-day alignment.
		step = 86400
		maxShift = 0
	}

	// Group buckets per model so each model aligns independently.
	type series struct {
		sup map[int64]*dto.DiffSide
		loc map[int64]*dto.DiffSide
	}
	models := map[string]*series{}
	get := func(m string) *series {
		s := models[m]
		if s == nil {
			s = &series{sup: map[int64]*dto.DiffSide{}, loc: map[int64]*dto.DiffSide{}}
			models[m] = s
		}
		return s
	}
	for k, s := range supAgg {
		get(k.model).sup[k.hourBucket] = s
	}
	for k, s := range locAgg {
		get(k.model).loc[k.hourBucket] = s
	}

	modelNames := make([]string, 0, len(models))
	for m := range models {
		modelNames = append(modelNames, m)
	}
	sort.Strings(modelNames)

	res := alignResult{modelDiffKind: map[string]string{}}

	for _, m := range modelNames {
		ms := models[m]
		shift := bestAlignShift(ms.sup, ms.loc, step, maxShift)

		// Union of local-anchor buckets (supplier bucket sb maps to sb-shift).
		anchors := map[int64]struct{}{}
		for b := range ms.loc {
			anchors[b] = struct{}{}
		}
		for sb := range ms.sup {
			anchors[sb-shift*step] = struct{}{}
		}
		bs := make([]int64, 0, len(anchors))
		for b := range anchors {
			bs = append(bs, b)
		}
		sort.Slice(bs, func(i, j int) bool { return bs[i] < bs[j] })

		residual := make([]float64, len(bs))
		for i, b := range bs {
			residual[i] = sideAmount(ms.sup[b+shift*step]) - sideAmount(ms.loc[b])
		}
		// Residual ±1h netting only makes sense at hourly granularity, where the
		// supplier's sub-hour drift splits a request across adjacent buckets. At
		// day granularity that drift is already contained within the day, so
		// netting adjacent *days* would wrongly hide a genuine overcharge-one-day
		// / undercharge-next-day pattern.
		if granularity == GranularityHour {
			netAdjacentOppositeSigns(bs, residual, step)
		}

		kinds := map[string]struct{}{}
		for i, b := range bs {
			if math.Abs(residual[i]) < common.ReconcileSignificantAmountCNY {
				continue // pure drift / rounding — hide
			}
			sup := ms.sup[b+shift*step]
			loc := ms.loc[b]
			status, kind := classifyDiff(sup, loc)
			kinds[kind] = struct{}{}

			var supplierBucket int64
			var regions []string
			if sup != nil {
				supplierBucket = b + shift*step
				if reg, ok := supRegions[reconcileBucketKey{m, supplierBucket}]; ok && len(reg) > 0 {
					regions = make([]string, 0, len(reg))
					for r := range reg {
						regions = append(regions, r)
					}
					sort.Strings(regions)
				}
			}
			switch status {
			case "supplier_only":
				res.supplierOnly++
			case "local_only":
				res.localOnly++
			}
			res.rows = append(res.rows, dto.ReconcileDiffRow{
				HourBucket:      b,
				Model:           m,
				Supplier:        sup,
				Local:           loc,
				Delta:           computeDelta(sup, loc),
				Status:          status,
				DiffKind:        kind,
				AlignShiftHours: int(shift),
				SupplierBucket:  supplierBucket,
				Regions:         regions,
			})
		}
		res.modelDiffKind[m] = mergeDiffKinds(kinds)
	}

	// Sort by (hour, model) and lay down the cumulative Δ¥ over the kept rows.
	sort.Slice(res.rows, func(i, j int) bool {
		if res.rows[i].HourBucket != res.rows[j].HourBucket {
			return res.rows[i].HourBucket < res.rows[j].HourBucket
		}
		return res.rows[i].Model < res.rows[j].Model
	})
	var cum float64
	for i := range res.rows {
		cum += res.rows[i].Delta.AmountCNY
		res.rows[i].CumulativeDeltaAmountCNY = roundTo6(cum)
	}
	return res
}

// bestAlignShift returns the integer-hour shift (in buckets, |shift| ≤ maxShift)
// that minimises Σ over local-anchor buckets of |supplier(b+shift) − local(b)|.
// Ties resolve to the smallest |shift| (most conservative — least re-attribution).
func bestAlignShift(sup, loc map[int64]*dto.DiffSide, step, maxShift int64) int64 {
	if maxShift == 0 || (len(sup) == 0 || len(loc) == 0) {
		return 0
	}
	bestShift := int64(0)
	bestCost := math.Inf(1)
	for s := -maxShift; s <= maxShift; s++ {
		anchors := map[int64]struct{}{}
		for b := range loc {
			anchors[b] = struct{}{}
		}
		for sb := range sup {
			anchors[sb-s*step] = struct{}{}
		}
		var cost float64
		for b := range anchors {
			cost += math.Abs(sideAmount(sup[b+s*step]) - sideAmount(loc[b]))
		}
		// Strictly-less keeps the first (smallest |s|, since we iterate -N..N
		// and prefer 0 explicitly on equality).
		if cost < bestCost-1e-9 || (math.Abs(cost-bestCost) <= 1e-9 && abs64(s) < abs64(bestShift)) {
			bestCost = cost
			bestShift = s
		}
	}
	return bestShift
}

// netAdjacentOppositeSigns soaks up residual ±1-bucket jitter. A whole bucket's
// billing shifted by ±1h lands as two opposite-sign deltas of *equal* magnitude
// (the same request, just one hour off), so we only treat a pair as drift —
// and cancel BOTH fully — when their magnitudes match within the significance
// threshold. Partial cancellation is deliberately avoided: if the two sides
// differ materially (e.g. +¥10 next to −¥7), they are not pure drift, so both
// rows are left intact. That keeps the detail summing to the authoritative
// summary / by_model gap (here +¥3 across the two rows) instead of emitting an
// inflated single +¥10 row and silently dropping the −¥7 side.
//
// This is virtual — it only decides which buckets are "real" differences; the
// displayed numbers are always the un-netted aligned values.
func netAdjacentOppositeSigns(buckets []int64, residual []float64, step int64) {
	for i := 0; i+1 < len(buckets); i++ {
		if buckets[i+1]-buckets[i] != step {
			continue
		}
		a, b := residual[i], residual[i+1]
		if a*b >= 0 {
			continue
		}
		if math.Abs(math.Abs(a)-math.Abs(b)) >= common.ReconcileSignificantAmountCNY {
			continue // materially unequal → not pure drift, keep both rows
		}
		residual[i] = 0
		residual[i+1] = 0
	}
}

// classifyDiff labels an aligned (supplier, local) pair. Significance of the
// *amount* is already established by the caller; here we only decide the kind.
func classifyDiff(sup, loc *dto.DiffSide) (status, kind string) {
	supEmpty := isEmptySide(sup)
	locEmpty := isEmptySide(loc)
	switch {
	case !supEmpty && locEmpty:
		return "supplier_only", diffKindMissingLocal
	case supEmpty && !locEmpty:
		return "local_only", diffKindMissingSupplier
	default:
		if tokenUsageDiffers(sup, loc) {
			return "matched", diffKindUsage
		}
		return "matched", diffKindPriceOnly
	}
}

// tokenUsageDiffers reports whether any token/count dimension differs by a
// genuine margin (≥ Tokens absolute AND ≥ Pct of the larger side) — i.e. a
// real usage mismatch rather than a price/ratio-only difference.
func tokenUsageDiffers(sup, loc *dto.DiffSide) bool {
	if sup == nil {
		sup = &dto.DiffSide{}
	}
	if loc == nil {
		loc = &dto.DiffSide{}
	}
	dims := [][2]int64{
		{sup.TokensInput, loc.TokensInput},
		{sup.TokensOutput, loc.TokensOutput},
		{sup.TokensCacheRead, loc.TokensCacheRead},
		{sup.TokensCacheWrite, loc.TokensCacheWrite},
		{sup.TokensCount, loc.TokensCount},
	}
	for _, d := range dims {
		delta := d[0] - d[1]
		if delta < 0 {
			delta = -delta
		}
		if delta < common.ReconcileSignificantTokens {
			continue
		}
		larger := d[0]
		if d[1] > larger {
			larger = d[1]
		}
		if larger <= 0 {
			return true
		}
		if float64(delta)/float64(larger) >= common.ReconcileSignificantPct {
			return true
		}
	}
	return false
}

// isEmptySide treats a nil or all-zero (tokens+count zero, amount sub-threshold)
// side as "absent" for missing-row classification.
func isEmptySide(s *dto.DiffSide) bool {
	if s == nil {
		return true
	}
	return s.TokensInput == 0 && s.TokensOutput == 0 &&
		s.TokensCacheRead == 0 && s.TokensCacheWrite == 0 && s.TokensCount == 0 &&
		math.Abs(s.AmountCNY) < common.ReconcileSignificantAmountCNY
}

// mergeDiffKinds collapses a model's per-row kinds into one label.
func mergeDiffKinds(kinds map[string]struct{}) string {
	switch len(kinds) {
	case 0:
		return ""
	case 1:
		for k := range kinds {
			return k
		}
	}
	return diffKindMixed
}

// buildDiffBreakdown attributes the interval total Δ¥ to the top contributing
// models, using the authoritative by_model amounts and the per-model diff_kind.
func buildDiffBreakdown(byModel []dto.ByModelStat, modelKinds map[string]string) []dto.DiffBreakdownItem {
	items := make([]dto.DiffBreakdownItem, 0, len(byModel))
	for _, m := range byModel {
		if math.Abs(m.DeltaAmountCNY) < common.ReconcileSignificantAmountCNY {
			continue
		}
		items = append(items, dto.DiffBreakdownItem{
			Model:          m.Model,
			DeltaAmountCNY: m.DeltaAmountCNY,
			DiffKind:       modelKinds[m.Model],
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return math.Abs(items[i].DeltaAmountCNY) > math.Abs(items[j].DeltaAmountCNY)
	})
	topN := common.ReconcileDiffBreakdownTopN
	if topN <= 0 || len(items) <= topN {
		return items
	}
	var otherSum float64
	for _, it := range items[topN:] {
		otherSum += it.DeltaAmountCNY
	}
	out := append([]dto.DiffBreakdownItem{}, items[:topN]...)
	if math.Abs(otherSum) >= common.ReconcileSignificantAmountCNY {
		out = append(out, dto.DiffBreakdownItem{Model: "其他", DeltaAmountCNY: roundTo6(otherSum)})
	}
	return out
}

// sideAmount is a nil-safe amount reader.
func sideAmount(s *dto.DiffSide) float64 {
	if s == nil {
		return 0
	}
	return s.AmountCNY
}

func abs64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}
