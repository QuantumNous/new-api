package billingexpr_test

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Claude-style: fixed tiers, input > 200K changes both input & output price
// ---------------------------------------------------------------------------

const claudeExpr = `p <= 200000 ? tier("standard", p * 1.5 + c * 7.5) : tier("long_context", p * 3.0 + c * 11.25)`

func TestClaude_StandardTier(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr(claudeExpr, billingexpr.TokenParams{P: 100000, C: 5000})
	require.NoError(t, err)
	want := 100000*1.5 + 5000*7.5
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "standard", trace.MatchedTier)
}

func TestClaude_LongContextTier(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr(claudeExpr, billingexpr.TokenParams{P: 300000, C: 10000})
	require.NoError(t, err)
	want := 300000*3.0 + 10000*11.25
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "long_context", trace.MatchedTier)
}

func TestClaude_BoundaryExact(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr(claudeExpr, billingexpr.TokenParams{P: 200000, C: 1000})
	require.NoError(t, err)
	want := 200000*1.5 + 1000*7.5
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "standard", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// GLM-style: multi-condition tiers with both input and output dimensions
// ---------------------------------------------------------------------------

const glmExpr = `
(
	p < 32000 && c < 200 ? tier("tier1_short", (p)*2 + c*8) :
	p < 32000 && c >= 200 ? tier("tier2_long_output", (p)*3 + c*14) :
	tier("tier3_long_input", (p)*4 + c*16)
) / 1000000
`

func TestGLM_Tier1(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr(glmExpr, billingexpr.TokenParams{P: 15000, C: 100})
	require.NoError(t, err)
	want := (15000.0*2 + 100.0*8) / 1000000
	assert.InDelta(t, want, cost, 1e-10)
	assert.Equal(t, "tier1_short", trace.MatchedTier)
}

func TestGLM_Tier2(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr(glmExpr, billingexpr.TokenParams{P: 15000, C: 500})
	require.NoError(t, err)
	want := (15000.0*3 + 500.0*14) / 1000000
	assert.InDelta(t, want, cost, 1e-10)
	assert.Equal(t, "tier2_long_output", trace.MatchedTier)
}

func TestGLM_Tier3(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr(glmExpr, billingexpr.TokenParams{P: 50000, C: 100})
	require.NoError(t, err)
	want := (50000.0*4 + 100.0*16) / 1000000
	assert.InDelta(t, want, cost, 1e-10)
	assert.Equal(t, "tier3_long_input", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// Simple flat-rate (no tier() call)
// ---------------------------------------------------------------------------

func TestSimpleExpr_NoTier(t *testing.T) {
	cost, trace, err := billingexpr.RunExpr("p * 0.5 + c * 1.0", billingexpr.TokenParams{P: 1000, C: 500})
	require.NoError(t, err)
	want := 1000*0.5 + 500*1.0
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// Math helper functions
// ---------------------------------------------------------------------------

func TestMathHelpers(t *testing.T) {
	cost, _, err := billingexpr.RunExpr("max(p, c) * 0.5 + min(p, c) * 0.1", billingexpr.TokenParams{P: 300, C: 500})
	require.NoError(t, err)
	want := 500*0.5 + 300*0.1
	assert.InDelta(t, want, cost, 1e-6)
}

func TestRequestProbeHelpers(t *testing.T) {
	cost, _, err := billingexpr.RunExprWithRequest(
		`p * 0.5 + c * 1.0 * (param("service_tier") == "fast" ? 2 : 1)`,
		billingexpr.TokenParams{P: 1000, C: 500},
		billingexpr.RequestInput{
			Body: []byte(`{"service_tier":"fast"}`),
		},
	)
	require.NoError(t, err)
	want := 1000*0.5 + 500*1.0*2
	assert.InDelta(t, want, cost, 1e-6)
}

func TestHeaderProbeHelper(t *testing.T) {
	cost, _, err := billingexpr.RunExprWithRequest(
		`p * 0.5 + c * 1.0 * (has(header("anthropic-beta"), "fast-mode") ? 2 : 1)`,
		billingexpr.TokenParams{P: 1000, C: 500},
		billingexpr.RequestInput{
			Headers: map[string]string{
				"Anthropic-Beta": "fast-mode-2026-02-01",
			},
		},
	)
	require.NoError(t, err)
	want := 1000*0.5 + 500*1.0*2
	assert.InDelta(t, want, cost, 1e-6)
}

func TestParamProbeNestedBool(t *testing.T) {
	cost, _, err := billingexpr.RunExprWithRequest(
		`p * (param("stream_options.fast_mode") == true ? 1.5 : 1.0)`,
		billingexpr.TokenParams{P: 100},
		billingexpr.RequestInput{
			Body: []byte(`{"stream_options":{"fast_mode":true}}`),
		},
	)
	require.NoError(t, err)
	want := 150.0
	assert.InDelta(t, want, cost, 1e-6)
}

func TestParamProbeArrayLength(t *testing.T) {
	cost, _, err := billingexpr.RunExprWithRequest(
		`p * (param("messages.#") > 20 ? 1.2 : 1.0)`,
		billingexpr.TokenParams{P: 100},
		billingexpr.RequestInput{
			Body: []byte(`{"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	)
	require.NoError(t, err)
	want := 120.0
	assert.InDelta(t, want, cost, 1e-6)
}

func TestRequestProbeMissingFieldReturnsNil(t *testing.T) {
	cost, _, err := billingexpr.RunExprWithRequest(
		`param("missing.value") == nil ? 2 : 1`,
		billingexpr.TokenParams{},
		billingexpr.RequestInput{
			Body: []byte(`{"service_tier":"standard"}`),
		},
	)
	require.NoError(t, err)
	assert.Equal(t, float64(2), cost)
}

func TestRequestProbeMultipleRulesTraceAllFactors(t *testing.T) {
	exprStr := `(tier("base", p * 2)) * (param("service_tier") == "fast" ? 2 : 1) * (has(header("anthropic-beta"), "fast-mode-2026-02-01") ? 2.5 : 1)`
	cost, trace, err := billingexpr.RunExprWithRequest(
		exprStr,
		billingexpr.TokenParams{P: 10},
		billingexpr.RequestInput{
			Headers: map[string]string{
				"Anthropic-Beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast"}`),
		},
	)

	require.NoError(t, err)
	assert.InDelta(t, 100, cost, 1e-6)
	assert.Equal(t, "base", trace.MatchedTier)
	assert.Equal(t, []billingexpr.RequestRuleTrace{
		{Cond: `param("service_tier") == "fast"`, Multiplier: 2, Matched: true},
		{Cond: `has(header("anthropic-beta"), "fast-mode-2026-02-01")`, Multiplier: 2.5, Matched: true},
	}, trace.RequestRules)
}

func TestRequestProbeTraceIncludesUnmatchedFactors(t *testing.T) {
	exprStr := `(tier("base", p * 2)) * (param("service_tier") == "fast" ? 2 : 1) * (has(header("anthropic-beta"), "fast-mode") ? 2.5 : 1)`
	cost, trace, err := billingexpr.RunExprWithRequest(
		exprStr,
		billingexpr.TokenParams{P: 10},
		billingexpr.RequestInput{Body: []byte(`{"service_tier":"fast"}`)},
	)

	require.NoError(t, err)
	assert.InDelta(t, 40, cost, 1e-6)
	assert.Equal(t, []billingexpr.RequestRuleTrace{
		{Cond: `param("service_tier") == "fast"`, Multiplier: 2, Matched: true},
		{Cond: `has(header("anthropic-beta"), "fast-mode")`, Multiplier: 2.5, Matched: false},
	}, trace.RequestRules)
}

func TestRequestProbeTracePreservesIntegerConditionalType(t *testing.T) {
	cost, trace, err := billingexpr.RunExprWithRequest(
		`5 % (param("service_tier") == "fast" ? 2 : 1)`,
		billingexpr.TokenParams{},
		billingexpr.RequestInput{Body: []byte(`{"service_tier":"fast"}`)},
	)

	require.NoError(t, err)
	assert.Equal(t, float64(1), cost)
	assert.Equal(t, []billingexpr.RequestRuleTrace{
		{Cond: `param("service_tier") == "fast"`, Multiplier: 2, Matched: true},
	}, trace.RequestRules)
}

func TestRequestProbeNonUnitFallbackIsNotTraced(t *testing.T) {
	cost, trace, err := billingexpr.RunExprWithRequest(
		`10 * (param("service_tier") == "fast" ? 2 : 1.5)`,
		billingexpr.TokenParams{},
		billingexpr.RequestInput{Body: []byte(`{"service_tier":"standard"}`)},
	)

	require.NoError(t, err)
	assert.InDelta(t, 15, cost, 1e-6)
	assert.Empty(t, trace.RequestRules)
}

func TestRequestProbeInternalTraceFunctionIsReserved(t *testing.T) {
	_, err := billingexpr.CompileFromCache(`_trace(0, true, 5.0)`)

	require.ErrorContains(t, err, `identifier "_trace" is reserved for internal use`)
}

func TestCeilFloor(t *testing.T) {
	cost, _, err := billingexpr.RunExpr("ceil(p / 1000) * 0.5", billingexpr.TokenParams{P: 1500})
	require.NoError(t, err)
	want := math.Ceil(1500.0/1000) * 0.5
	assert.InDelta(t, want, cost, 1e-6)
}

// ---------------------------------------------------------------------------
// Zero tokens
// ---------------------------------------------------------------------------

func TestZeroTokens(t *testing.T) {
	cost, _, err := billingexpr.RunExpr(claudeExpr, billingexpr.TokenParams{})
	require.NoError(t, err)
	assert.Equal(t, float64(0), cost)
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

func TestQuotaRound(t *testing.T) {
	tests := []struct {
		in   float64
		want int
	}{
		{0, 0},
		{0.4, 0},
		{0.5, 1},
		{0.6, 1},
		{1.5, 2},
		{-0.5, -1},
		{-0.6, -1},
		{999.4999, 999},
		{999.5, 1000},
		{1e9 + 0.5, 1e9 + 1},
		// Oversized expression results saturate at the single-request limit (delegated to
		// common.QuotaRound); full saturation coverage lives in common.
		{3.6893488147419103e19, common.MaxQuota},
	}
	for _, tt := range tests {
		got := billingexpr.QuotaRound(tt.in)
		assert.Equal(t, tt.want, got)
	}
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

func TestComputeTieredQuota_Basic(t *testing.T) {
	snap := &billingexpr.BillingSnapshot{
		BillingMode:               "tiered_expr",
		ExprString:                claudeExpr,
		ExprHash:                  billingexpr.ExprHashString(claudeExpr),
		GroupRatio:                1.0,
		EstimatedPromptTokens:     100000,
		EstimatedCompletionTokens: 5000,
		EstimatedQuotaBeforeGroup: (100000*1.5 + 5000*7.5) / 1_000_000 * 500_000,
		EstimatedQuotaAfterGroup:  billingexpr.QuotaRound((100000*1.5 + 5000*7.5) / 1_000_000 * 500_000),
		EstimatedTier:             "standard",
		QuotaPerUnit:              500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 300000, C: 10000})
	require.NoError(t, err)

	wantBefore := (300000*3.0 + 10000*11.25) / 1_000_000 * 500_000
	assert.InDelta(t, wantBefore, result.ActualQuotaBeforeGroup, 1e-6)
	assert.Equal(t, "long_context", result.MatchedTier)
	assert.True(t, result.CrossedTier, "expected crossed_tier=true (estimated standard, actual long_context)")
}

func TestComputeTieredQuota_SameTier(t *testing.T) {
	snap := &billingexpr.BillingSnapshot{
		BillingMode:               "tiered_expr",
		ExprString:                claudeExpr,
		ExprHash:                  billingexpr.ExprHashString(claudeExpr),
		GroupRatio:                1.5,
		EstimatedPromptTokens:     50000,
		EstimatedCompletionTokens: 1000,
		EstimatedQuotaBeforeGroup: (50000*1.5 + 1000*7.5) / 1_000_000 * 500_000,
		EstimatedQuotaAfterGroup:  billingexpr.QuotaRound((50000*1.5 + 1000*7.5) / 1_000_000 * 500_000 * 1.5),
		EstimatedTier:             "standard",
		QuotaPerUnit:              500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 80000, C: 2000})
	require.NoError(t, err)

	wantBefore := (80000*1.5 + 2000*7.5) / 1_000_000 * 500_000
	wantAfter := billingexpr.QuotaRound(wantBefore * 1.5)
	assert.Equal(t, wantAfter, result.ActualQuotaAfterGroup)
	assert.False(t, result.CrossedTier, "expected crossed_tier=false (both standard)")
}

// ---------------------------------------------------------------------------
// Compile errors
// ---------------------------------------------------------------------------

func TestCompileError(t *testing.T) {
	_, _, err := billingexpr.RunExpr("invalid +-+ syntax", billingexpr.TokenParams{})
	assert.Error(t, err)
}

// ---------------------------------------------------------------------------
// Compile Cache
// ---------------------------------------------------------------------------

func TestCompileCacheAndInvalidationPreserveRequestResults(t *testing.T) {
	const expression = `tier("base", p * 0.5) * (param("fast") == true ? 2 : 1)`
	billingexpr.InvalidateCache()
	t.Cleanup(billingexpr.InvalidateCache)
	for _, tc := range []struct {
		name       string
		invalidate bool
		prompt     float64
		body       string
		want       float64
		matched    bool
	}{
		{"cold", false, 100, `{"fast":true}`, 100, true},
		{"cached", false, 300, `{"fast":false}`, 150, false},
		{"invalidated", true, 100, `{"fast":true}`, 100, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.invalidate {
				billingexpr.InvalidateCache()
			}
			cost, trace, err := billingexpr.RunExprWithRequest(expression,
				billingexpr.TokenParams{P: tc.prompt}, billingexpr.RequestInput{Body: []byte(tc.body)})
			require.NoError(t, err)
			assert.Equal(t, tc.want, cost)
			assert.Equal(t, "base", trace.MatchedTier)
			assert.Equal(t, []billingexpr.RequestRuleTrace{
				{Cond: `param("fast") == true`, Multiplier: 2, Matched: tc.matched},
			}, trace.RequestRules)
		})
	}
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

func TestExprHashString_Deterministic(t *testing.T) {
	h1 := billingexpr.ExprHashString("p * 0.5")
	h2 := billingexpr.ExprHashString("p * 0.5")
	assert.Equal(t, h2, h1)
	h3 := billingexpr.ExprHashString("p * 0.6")
	assert.NotEqual(t, h3, h1)
}

// ---------------------------------------------------------------------------
// Cache variables: present
// ---------------------------------------------------------------------------

const claudeWithCacheExpr = `p <= 200000 ? tier("standard", p * 1.5 + c * 7.5 + cr * 0.15 + cc * 1.875) : tier("long_context", p * 3.0 + c * 11.25 + cr * 0.3 + cc * 3.75)`

func TestCachePresent_StandardTier(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 5000, CR: 50000, CC: 10000}
	cost, trace, err := billingexpr.RunExpr(claudeWithCacheExpr, params)
	require.NoError(t, err)
	want := 100000*1.5 + 5000*7.5 + 50000*0.15 + 10000*1.875
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "standard", trace.MatchedTier)
}

func TestCachePresent_LongContextTier(t *testing.T) {
	params := billingexpr.TokenParams{P: 300000, C: 10000, CR: 100000, CC: 20000}
	cost, trace, err := billingexpr.RunExpr(claudeWithCacheExpr, params)
	require.NoError(t, err)
	want := 300000*3.0 + 10000*11.25 + 100000*0.3 + 20000*3.75
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "long_context", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// Cache variables: absent (all zero) — same expression still works
// ---------------------------------------------------------------------------

func TestCacheAbsent_ZeroCacheTokens(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 5000}
	cost, trace, err := billingexpr.RunExpr(claudeWithCacheExpr, params)
	require.NoError(t, err)
	want := 100000*1.5 + 5000*7.5
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "standard", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// Mixed cache fields: cc and cc1h non-zero
// ---------------------------------------------------------------------------

const claudeCacheSplitExpr = `tier("default", p * 1.5 + c * 7.5 + cr * 0.15 + cc * 2.0 + cc1h * 3.0)`

func TestMixedCacheFields(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 5000, CR: 10000, CC: 5000, CC1h: 2000}
	cost, _, err := billingexpr.RunExpr(claudeCacheSplitExpr, params)
	require.NoError(t, err)
	want := 100000*1.5 + 5000*7.5 + 10000*0.15 + 5000*2.0 + 2000*3.0
	assert.InDelta(t, want, cost, 1e-6)
}

func TestMixedCacheFields_AllCacheZero(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 5000}
	cost, _, err := billingexpr.RunExpr(claudeCacheSplitExpr, params)
	require.NoError(t, err)
	want := 100000*1.5 + 5000*7.5
	assert.InDelta(t, want, cost, 1e-6)
}

// ---------------------------------------------------------------------------
// Backward compatibility: p+c only expressions still work with TokenParams
// ---------------------------------------------------------------------------

func TestBackwardCompat_OldExprWithTokenParams(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 5000, CR: 99999, CC: 88888}
	cost, trace, err := billingexpr.RunExpr(claudeExpr, params)
	require.NoError(t, err)
	want := 100000*1.5 + 5000*7.5
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "standard", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// Settlement with cache tokens
// ---------------------------------------------------------------------------

func TestComputeTieredQuota_WithCache(t *testing.T) {
	snap := &billingexpr.BillingSnapshot{
		BillingMode:               "tiered_expr",
		ExprString:                claudeWithCacheExpr,
		ExprHash:                  billingexpr.ExprHashString(claudeWithCacheExpr),
		GroupRatio:                1.0,
		EstimatedPromptTokens:     100000,
		EstimatedCompletionTokens: 5000,
		EstimatedQuotaBeforeGroup: (100000*1.5 + 5000*7.5) / 1_000_000 * 500_000,
		EstimatedQuotaAfterGroup:  billingexpr.QuotaRound((100000*1.5 + 5000*7.5) / 1_000_000 * 500_000),
		EstimatedTier:             "standard",
		QuotaPerUnit:              500_000,
	}

	params := billingexpr.TokenParams{P: 100000, C: 5000, CR: 50000, CC: 10000}
	result, err := billingexpr.ComputeTieredQuota(snap, params)
	require.NoError(t, err)

	wantBefore := (100000*1.5 + 5000*7.5 + 50000*0.15 + 10000*1.875) / 1_000_000 * 500_000
	assert.InDelta(t, wantBefore, result.ActualQuotaBeforeGroup, 1e-6)
	assert.Equal(t, "standard", result.MatchedTier)
	assert.False(t, result.CrossedTier, "expected crossed_tier=false (same tier)")
}

func TestComputeTieredQuota_WithCacheCrossTier(t *testing.T) {
	snap := &billingexpr.BillingSnapshot{
		BillingMode:               "tiered_expr",
		ExprString:                claudeWithCacheExpr,
		ExprHash:                  billingexpr.ExprHashString(claudeWithCacheExpr),
		GroupRatio:                2.0,
		EstimatedPromptTokens:     100000,
		EstimatedCompletionTokens: 5000,
		EstimatedQuotaBeforeGroup: (100000*1.5 + 5000*7.5) / 1_000_000 * 500_000,
		EstimatedQuotaAfterGroup:  billingexpr.QuotaRound((100000*1.5 + 5000*7.5) / 1_000_000 * 500_000 * 2.0),
		EstimatedTier:             "standard",
		QuotaPerUnit:              500_000,
	}

	params := billingexpr.TokenParams{P: 300000, C: 10000, CR: 50000, CC: 10000}
	result, err := billingexpr.ComputeTieredQuota(snap, params)
	require.NoError(t, err)

	wantBefore := (300000*3.0 + 10000*11.25 + 50000*0.3 + 10000*3.75) / 1_000_000 * 500_000
	wantAfter := billingexpr.QuotaRound(wantBefore * 2.0)
	assert.InDelta(t, wantBefore, result.ActualQuotaBeforeGroup, 1e-6)
	assert.Equal(t, wantAfter, result.ActualQuotaAfterGroup)
	assert.True(t, result.CrossedTier, "expected crossed_tier=true (estimated standard, actual long_context)")
}

// ---------------------------------------------------------------------------
// Settlement-level tests for ComputeTieredQuota
// ---------------------------------------------------------------------------

func TestComputeTieredQuota_BasicSettlement(t *testing.T) {
	exprStr := `tier("default", p + c)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   1.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 3000, C: 2000})
	require.NoError(t, err)
	// exprOutput = 5000; quota = 5000 / 1M * 500K = 2500
	assert.InDelta(t, 2500, result.ActualQuotaBeforeGroup, 1e-6)
	assert.Equal(t, 2500, result.ActualQuotaAfterGroup)
	assert.Equal(t, "default", result.MatchedTier)
}

func TestComputeTieredQuota_WithGroupRatio(t *testing.T) {
	exprStr := `tier("default", p + c)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   2.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1000, C: 500})
	require.NoError(t, err)
	// exprOutput = 1500; quotaBeforeGroup = 750; afterGroup = round(750 * 2.0) = 1500
	assert.Equal(t, 1500, result.ActualQuotaAfterGroup)
}

func TestComputeTieredQuota_ZeroTokens(t *testing.T) {
	exprStr := `tier("default", p * 2 + c * 10)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   1.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{})
	require.NoError(t, err)
	assert.Equal(t, 0, result.ActualQuotaAfterGroup)
}

func TestComputeTieredQuota_RoundingEdge(t *testing.T) {
	exprStr := `tier("default", p * 0.5)` // 3 * 0.5 = 1.5 (expr); 1.5 / 1M * 500K = 0.75; round(0.75) = 1
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   1.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 3})
	require.NoError(t, err)
	// 3 * 0.5 = 1.5 (expr); quota = 1.5 / 1M * 500K = 0.75; round(0.75) = 1
	assert.Equal(t, 1, result.ActualQuotaAfterGroup)
}

func TestComputeTieredQuota_RoundingEdgeDown(t *testing.T) {
	exprStr := `tier("default", p * 0.4)` // 3 * 0.4 = 1.2 (expr); 1.2 / 1M * 500K = 0.6; round(0.6) = 1
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   1.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 3})
	require.NoError(t, err)
	// 3 * 0.4 = 1.2 (expr); quota = 1.2 / 1M * 500K = 0.6; round(0.6) = 1
	assert.Equal(t, 1, result.ActualQuotaAfterGroup)
}

func TestComputeTieredQuotaWithRequest_ProbeAffectsQuota(t *testing.T) {
	exprStr := `param("fast") == true ? tier("fast", p * 4) : tier("normal", p * 2)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:   "tiered_expr",
		ExprString:    exprStr,
		ExprHash:      billingexpr.ExprHashString(exprStr),
		GroupRatio:    1.0,
		EstimatedTier: "normal",
		QuotaPerUnit:  500_000,
	}

	// Without request: normal tier
	r1, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1000})
	require.NoError(t, err)
	// normal: p*2 = 2000; quota = 2000 / 1M * 500K = 1000
	assert.Equal(t, 1000, r1.ActualQuotaAfterGroup)

	// With request: fast tier
	r2, err := billingexpr.ComputeTieredQuotaWithRequest(snap, billingexpr.TokenParams{P: 1000}, billingexpr.RequestInput{
		Body: []byte(`{"fast":true}`),
	})
	require.NoError(t, err)
	// fast: p*4 = 4000; quota = 4000 / 1M * 500K = 2000
	assert.Equal(t, 2000, r2.ActualQuotaAfterGroup)
	assert.True(t, r2.CrossedTier, "expected CrossedTier = true when probe changes tier")
}

func TestComputeTieredQuota_BoundaryTierCrossing(t *testing.T) {
	exprStr := `p <= 100000 ? tier("small", p * 1) : tier("large", p * 2)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:   "tiered_expr",
		ExprString:    exprStr,
		ExprHash:      billingexpr.ExprHashString(exprStr),
		GroupRatio:    1.0,
		EstimatedTier: "small",
		QuotaPerUnit:  500_000,
	}

	// At boundary: small, p*1 = 100000; quota = 100000 / 1M * 500K = 50000
	r1, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 100000})
	require.NoError(t, err)
	assert.Equal(t, "small", r1.MatchedTier)
	assert.Equal(t, 50000, r1.ActualQuotaAfterGroup)

	// Past boundary: large, p*2 = 200002; quota = 200002 / 1M * 500K = 100001
	r2, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 100001})
	require.NoError(t, err)
	assert.Equal(t, "large", r2.MatchedTier)
	assert.Equal(t, 100001, r2.ActualQuotaAfterGroup)
	assert.True(t, r2.CrossedTier, "expected CrossedTier = true")
}

// ---------------------------------------------------------------------------
// Time function tests
// ---------------------------------------------------------------------------

func TestTimeFunctions_ValidTimezone(t *testing.T) {
	exprStr := `tier("default", p) * (hour("UTC") >= 0 ? 1 : 1)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 100})
	require.NoError(t, err)
	assert.Equal(t, float64(100), cost)
}

func TestTimeFunctions_AllFunctionsCompile(t *testing.T) {
	exprStr := `tier("default", p) * (hour("Asia/Shanghai") >= 0 ? 1 : 1) * (minute("UTC") >= 0 ? 1 : 1) * (weekday("UTC") >= 0 ? 1 : 1) * (month("UTC") >= 1 ? 1 : 1) * (day("UTC") >= 1 ? 1 : 1)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 500})
	require.NoError(t, err)
	assert.Equal(t, float64(500), cost)
}

func TestTimeFunctions_InvalidTimezone(t *testing.T) {
	exprStr := `tier("default", p) * (hour("Invalid/Zone") >= 0 ? 1 : 2)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 100})
	require.NoError(t, err)
	// Invalid timezone falls back to UTC; hour is 0-23, so condition is always true
	assert.Equal(t, float64(100), cost)
}

func TestTimeFunctions_EmptyTimezone(t *testing.T) {
	exprStr := `tier("default", p) * (hour("") >= 0 ? 1 : 2)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 100})
	require.NoError(t, err)
	assert.Equal(t, float64(100), cost)
}

func TestTimeFunctions_NightDiscountPattern(t *testing.T) {
	exprStr := `tier("default", p * 2 + c * 10) * (hour("UTC") >= 21 || hour("UTC") < 6 ? 0.5 : 1)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 1000, C: 500})
	require.NoError(t, err)
	// Base = 1000*2 + 500*10 = 7000; multiplier is either 0.5 or 1 depending on current UTC hour
	assert.Contains(t, []float64{7000, 3500}, cost)
}

func TestTimeFunctions_WeekdayRange(t *testing.T) {
	exprStr := `tier("default", p) * (weekday("UTC") >= 0 && weekday("UTC") <= 6 ? 1 : 999)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 100})
	require.NoError(t, err)
	// weekday is always 0-6, so multiplier is always 1
	assert.Equal(t, float64(100), cost)
}

func TestTimeFunctions_MonthDayPattern(t *testing.T) {
	exprStr := `tier("default", p) * (month("Asia/Shanghai") == 1 && day("Asia/Shanghai") == 1 ? 0.5 : 1)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 1000})
	require.NoError(t, err)
	// Either 1000 (not Jan 1) or 500 (Jan 1) — both are valid
	assert.Contains(t, []float64{1000, 500}, cost)
}

// ---------------------------------------------------------------------------
// Image and audio token tests
// ---------------------------------------------------------------------------

func TestImageTokenVariable(t *testing.T) {
	exprStr := `tier("base", p * 2 + c * 10 + img * 5)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 1000, C: 500, Img: 200})
	require.NoError(t, err)
	// 1000*2 + 500*10 + 200*5 = 2000 + 5000 + 1000 = 8000
	assert.InDelta(t, 8000, cost, 1e-6)
}

func TestAudioTokenVariables(t *testing.T) {
	exprStr := `tier("base", p * 2 + c * 10 + ai * 50 + ao * 100)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 1000, C: 500, AI: 100, AO: 50})
	require.NoError(t, err)
	// 1000*2 + 500*10 + 100*50 + 50*100 = 2000 + 5000 + 5000 + 5000 = 17000
	assert.InDelta(t, 17000, cost, 1e-6)
}

func TestImageAudioVariables(t *testing.T) {
	exprStr := `tier("base", p * 1 + img * 3 + ai * 5 + ao * 10)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 100, Img: 50, AI: 20, AO: 10})
	require.NoError(t, err)
	// 100*1 + 50*3 + 20*5 + 10*10 = 100 + 150 + 100 + 100 = 450
	assert.InDelta(t, 450, cost, 1e-6)
}

func TestImageAudioZero(t *testing.T) {
	exprStr := `tier("base", p * 2 + img * 5 + ai * 50 + ao * 100)`
	cost, _, err := billingexpr.RunExpr(exprStr, billingexpr.TokenParams{P: 1000})
	require.NoError(t, err)
	// img, ai, ao default to 0
	assert.InDelta(t, 2000, cost, 1e-6)
}

// ---------------------------------------------------------------------------
// len variable tests — tier conditions based on context length
// ---------------------------------------------------------------------------

const lenTieredExpr = `len <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3) : tier("long_context", p * 6 + c * 22.5 + cr * 0.6)`

func TestLen_StandardTier(t *testing.T) {
	params := billingexpr.TokenParams{P: 80000, C: 5000, Len: 100000, CR: 20000}
	cost, trace, err := billingexpr.RunExpr(lenTieredExpr, params)
	require.NoError(t, err)
	want := 80000*3 + 5000*15 + 20000*0.3
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "standard", trace.MatchedTier)
}

func TestLen_LongContextTier(t *testing.T) {
	// p is low (cache subtracted), but len is high (full context)
	params := billingexpr.TokenParams{P: 50000, C: 5000, Len: 300000, CR: 250000}
	cost, trace, err := billingexpr.RunExpr(lenTieredExpr, params)
	require.NoError(t, err)
	want := 50000*6 + 5000*22.5 + 250000*0.6
	assert.InDelta(t, want, cost, 1e-6)
	assert.Equal(t, "long_context", trace.MatchedTier)
}

func TestLen_BoundaryExact(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 1000, Len: 200000, CR: 100000}
	_, trace, err := billingexpr.RunExpr(lenTieredExpr, params)
	require.NoError(t, err)
	assert.Equal(t, "standard", trace.MatchedTier)
}

func TestLen_BoundaryPlusOne(t *testing.T) {
	params := billingexpr.TokenParams{P: 100000, C: 1000, Len: 200001, CR: 100001}
	_, trace, err := billingexpr.RunExpr(lenTieredExpr, params)
	require.NoError(t, err)
	assert.Equal(t, "long_context", trace.MatchedTier)
}

func TestLen_ZeroDefaultsToZero(t *testing.T) {
	// len defaults to 0 when not set
	params := billingexpr.TokenParams{P: 1000, C: 500}
	_, trace, err := billingexpr.RunExpr(lenTieredExpr, params)
	require.NoError(t, err)
	assert.Equal(t, "standard", trace.MatchedTier)
}

// ---------------------------------------------------------------------------
// Benchmarks: compile vs cached execution
// ---------------------------------------------------------------------------

const benchComplexExpr = `len <= 200000 ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6 + img * 3 + img_o * 30 + ai * 10 + ao * 40) : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12 + img * 6 + img_o * 60 + ai * 20 + ao * 80)`

func BenchmarkExprCompile(b *testing.B) {
	for i := 0; i < b.N; i++ {
		billingexpr.InvalidateCache()
		billingexpr.CompileFromCache(benchComplexExpr)
	}
}

func BenchmarkExprRunCached(b *testing.B) {
	billingexpr.CompileFromCache(benchComplexExpr)
	params := billingexpr.TokenParams{P: 150000, C: 10000, Len: 188000, CR: 30000, CC: 5000, Img: 2000, AI: 1000, AO: 500}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		billingexpr.RunExpr(benchComplexExpr, params)
	}
}
