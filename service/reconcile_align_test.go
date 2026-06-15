package service

import (
	"math"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

// hour-bucket base (arbitrary; alignment only uses 3600-spacing arithmetic).
const tb = int64(1780567200) // 2026-06-04 18:00 CST

const hr = int64(3600)

func side(amount float64, in, out, cr, cw, count int64) *dto.DiffSide {
	return &dto.DiffSide{
		TokensInput: in, TokensOutput: out, TokensCacheRead: cr,
		TokensCacheWrite: cw, TokensCount: count, AmountCNY: amount,
	}
}

func sup(m string, b int64, s *dto.DiffSide) (reconcileBucketKey, *dto.DiffSide) {
	return reconcileBucketKey{m, b}, s
}

// run is a tiny helper that builds the two maps and aligns.
func run(supEntries, locEntries map[reconcileBucketKey]*dto.DiffSide) alignResult {
	return alignAndExtractDiffs(supEntries, locEntries, nil, GranularityHour)
}

func TestReconcileAlign_SystematicPlus1h(t *testing.T) {
	// Supplier traffic lands one hour LATER than ours (the measured dominant
	// case). Same numbers, shifted +1 bucket → must fully align, zero rows.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{}
	for i := int64(0); i < 4; i++ {
		amt := 1.0 + float64(i)
		locEntries[reconcileBucketKey{"GLM-5.1", tb + i*hr}] = side(amt, 1000, 200, 0, 0, 0)
		supEntries[reconcileBucketKey{"GLM-5.1", tb + (i+1)*hr}] = side(amt, 1000, 200, 0, 0, 0)
	}
	res := run(supEntries, locEntries)
	if len(res.rows) != 0 {
		t.Fatalf("expected 0 significant rows after +1h alignment, got %d: %+v", len(res.rows), res.rows)
	}
	if k := res.modelDiffKind["GLM-5.1"]; k != "" {
		t.Fatalf("expected empty diff kind, got %q", k)
	}
}

func TestReconcileAlign_SystematicMinus1h(t *testing.T) {
	// Supplier one hour EARLIER than ours → shift -1 should align.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{}
	for i := int64(0); i < 4; i++ {
		amt := 2.0 + float64(i)
		locEntries[reconcileBucketKey{"Kimi", tb + (i+1)*hr}] = side(amt, 500, 100, 0, 0, 0)
		supEntries[reconcileBucketKey{"Kimi", tb + i*hr}] = side(amt, 500, 100, 0, 0, 0)
	}
	if got := bestAlignShift(mapFor("Kimi", supEntries), mapFor("Kimi", locEntries), hr, 1); got != -1 {
		t.Fatalf("expected shift -1, got %d", got)
	}
	if res := run(supEntries, locEntries); len(res.rows) != 0 {
		t.Fatalf("expected 0 rows, got %d", len(res.rows))
	}
}

func TestReconcileAlign_ExactMatch(t *testing.T) {
	supEntries := map[reconcileBucketKey]*dto.DiffSide{}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{}
	for i := int64(0); i < 3; i++ {
		supEntries[reconcileBucketKey{"Qwen", tb + i*hr}] = side(1, 100, 10, 0, 0, 0)
		locEntries[reconcileBucketKey{"Qwen", tb + i*hr}] = side(1, 100, 10, 0, 0, 0)
	}
	if res := run(supEntries, locEntries); len(res.rows) != 0 {
		t.Fatalf("expected 0 rows on exact match, got %d", len(res.rows))
	}
}

func TestReconcileAlign_PriceOnly(t *testing.T) {
	// Same count (12 vs 12), amount 5×: classic ratio misconfig → price_only.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"MiniMax-T2V-01", tb}: side(36, 0, 0, 0, 0, 12),
	}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"MiniMax-T2V-01", tb}: side(180, 0, 0, 0, 0, 12),
	}
	res := run(supEntries, locEntries)
	if len(res.rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(res.rows))
	}
	r := res.rows[0]
	if r.DiffKind != diffKindPriceOnly {
		t.Fatalf("expected price_only, got %q", r.DiffKind)
	}
	if r.Status != "matched" {
		t.Fatalf("expected matched status, got %q", r.Status)
	}
	if math.Abs(r.Delta.AmountCNY-(-144)) > 1e-6 {
		t.Fatalf("expected Δ -144, got %v", r.Delta.AmountCNY)
	}
	if res.modelDiffKind["MiniMax-T2V-01"] != diffKindPriceOnly {
		t.Fatalf("model kind mismatch: %q", res.modelDiffKind["MiniMax-T2V-01"])
	}
}

func TestReconcileAlign_Usage(t *testing.T) {
	// Our input/cache far exceed supplier → genuine usage mismatch.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"DeepSeek-V4-Pro", tb}: side(3.59, 272597, 13449, 0, 0, 0),
	}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"DeepSeek-V4-Pro", tb}: side(24.43, 950747, 139102, 9682688, 0, 0),
	}
	res := run(supEntries, locEntries)
	if len(res.rows) != 1 || res.rows[0].DiffKind != diffKindUsage {
		t.Fatalf("expected 1 usage row, got %+v", res.rows)
	}
}

func TestReconcileAlign_MissingLocal(t *testing.T) {
	// Supplier billed a video, we have nothing, no neighbour → missing_local.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"MiniMax-Hailuo-02", tb}: side(2.29, 0, 0, 0, 0, 1),
	}
	res := run(supEntries, map[reconcileBucketKey]*dto.DiffSide{})
	if len(res.rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(res.rows))
	}
	if res.rows[0].DiffKind != diffKindMissingLocal || res.rows[0].Status != "supplier_only" {
		t.Fatalf("expected supplier_only/missing_local, got %s/%s", res.rows[0].Status, res.rows[0].DiffKind)
	}
	if res.supplierOnly != 1 {
		t.Fatalf("expected supplierOnly=1, got %d", res.supplierOnly)
	}
}

func TestReconcileAlign_DriftPairNetted(t *testing.T) {
	// Supplier extra at b, our extra at b+1, equal amounts, no other data →
	// ±1h netting must cancel both → zero rows.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"GLM-5.1", tb}: side(5, 1000, 100, 0, 0, 0),
	}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"GLM-5.1", tb + hr}: side(5, 1000, 100, 0, 0, 0),
	}
	// Note: this is the systematic +1h case (shift=1) so it aligns anyway;
	// to exercise the *netting* path specifically, force shift=0 by adding a
	// matched anchor that makes shift 0 the minimum.
	supEntries[reconcileBucketKey{"GLM-5.1", tb - 5*hr}] = side(10, 0, 0, 0, 0, 0)
	locEntries[reconcileBucketKey{"GLM-5.1", tb - 5*hr}] = side(10, 0, 0, 0, 0, 0)
	res := run(supEntries, locEntries)
	if len(res.rows) != 0 {
		t.Fatalf("expected drift pair netted to 0 rows, got %d: %+v", len(res.rows), res.rows)
	}
}

func TestReconcileAlign_PartialDriftKeepsBoth(t *testing.T) {
	// Materially-unequal adjacent opposite-sign buckets (+¥10 vs −¥7) are NOT
	// pure drift: both rows must survive so the detail still sums to the real
	// gap (+¥3), instead of emitting an inflated +¥10 row and hiding the ¥7.
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"GLM-5.1", tb}:        side(10, 2000, 0, 0, 0, 0),
		{"GLM-5.1", tb - 5*hr}: side(10, 0, 0, 0, 0, 0), // matched anchor → forces shift 0
	}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"GLM-5.1", tb + hr}:   side(7, 1400, 0, 0, 0, 0),
		{"GLM-5.1", tb - 5*hr}: side(10, 0, 0, 0, 0, 0),
	}
	res := run(supEntries, locEntries)
	if len(res.rows) != 2 {
		t.Fatalf("expected 2 rows (both sides kept), got %d: %+v", len(res.rows), res.rows)
	}
	// Final cumulative must equal the authoritative model gap: 10 - 7 = +3.
	final := res.rows[len(res.rows)-1].CumulativeDeltaAmountCNY
	if math.Abs(final-3) > 1e-6 {
		t.Fatalf("expected detail cumulative to sum to +3, got %v", final)
	}
}

func TestReconcileAlign_DayGranularitySkipsNetting(t *testing.T) {
	// At day granularity, adjacent-day equal-and-opposite differences are NOT
	// drift and must NOT be netted away — a real overcharge on day D and
	// undercharge on day D+1 has to stay visible as two rows.
	const day = int64(86400)
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"GLM-5.1", tb}: side(10, 0, 0, 0, 0, 0), // supplier-only on day D
	}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"GLM-5.1", tb + day}: side(10, 0, 0, 0, 0, 0), // local-only on day D+1
	}
	res := alignAndExtractDiffs(supEntries, locEntries, nil, GranularityDay)
	if len(res.rows) != 2 {
		t.Fatalf("expected 2 day rows (no netting), got %d: %+v", len(res.rows), res.rows)
	}
}

func TestReconcileAlign_DoesNotMutateInputs(t *testing.T) {
	supEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"M", tb}: side(36, 0, 0, 0, 0, 12),
	}
	locEntries := map[reconcileBucketKey]*dto.DiffSide{
		{"M", tb}: side(180, 0, 0, 0, 0, 12),
	}
	supCopy := deepCopySides(supEntries)
	locCopy := deepCopySides(locEntries)
	_ = run(supEntries, locEntries)
	if !reflect.DeepEqual(supEntries, supCopy) {
		t.Fatalf("supplier aggregate mutated by alignment")
	}
	if !reflect.DeepEqual(locEntries, locCopy) {
		t.Fatalf("local aggregate mutated by alignment")
	}
}

func TestBuildDiffBreakdown_TopNAndOther(t *testing.T) {
	byModel := []dto.ByModelStat{
		{Model: "A", DeltaAmountCNY: 144},
		{Model: "B", DeltaAmountCNY: 69},
		{Model: "C", DeltaAmountCNY: -2.29},
		{Model: "D", DeltaAmountCNY: 1.5},
		{Model: "E", DeltaAmountCNY: 1.2},
		{Model: "F", DeltaAmountCNY: 1.1},
		{Model: "G", DeltaAmountCNY: 0.001}, // below threshold, dropped
	}
	kinds := map[string]string{"A": diffKindPriceOnly, "B": diffKindUsage, "C": diffKindMissingLocal}
	out := buildDiffBreakdown(byModel, kinds)
	// top 5 + 其他
	if len(out) != 6 {
		t.Fatalf("expected 5 top + 1 其他 = 6, got %d: %+v", len(out), out)
	}
	if out[0].Model != "A" || out[0].DiffKind != diffKindPriceOnly {
		t.Fatalf("expected A/price_only first, got %+v", out[0])
	}
	last := out[len(out)-1]
	if last.Model != "其他" {
		t.Fatalf("expected last item 其他, got %q", last.Model)
	}
	if math.Abs(last.DeltaAmountCNY-1.1) > 1e-6 { // only F spills past top-5
		t.Fatalf("expected 其他 = 1.1, got %v", last.DeltaAmountCNY)
	}
}

// --- test helpers ---

func mapFor(model string, m map[reconcileBucketKey]*dto.DiffSide) map[int64]*dto.DiffSide {
	out := map[int64]*dto.DiffSide{}
	for k, v := range m {
		if k.model == model {
			out[k.hourBucket] = v
		}
	}
	return out
}

func deepCopySides(m map[reconcileBucketKey]*dto.DiffSide) map[reconcileBucketKey]*dto.DiffSide {
	out := map[reconcileBucketKey]*dto.DiffSide{}
	for k, v := range m {
		c := *v
		out[k] = &c
	}
	return out
}
