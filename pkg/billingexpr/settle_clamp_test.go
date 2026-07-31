package billingexpr_test

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestComputeTieredQuota_ClampOnOverflow guards the billing-safety invariant
// that an oversized tiered settlement clamps to the int32 max instead of
// wrapping into a credit, and that the saturation event is surfaced on the
// result so callers can record it for admin auditing.
func TestComputeTieredQuota_ClampOnOverflow(t *testing.T) {
	// exprOutput = p * 1e9 = 1e18; quotaBeforeGroup = 1e18 / 1e6 * 5e5 = 5e17,
	// which far exceeds MaxInt32 and must saturate.
	exprStr := `tier("base", p * 1000000000)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   1.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1_000_000_000})
	require.NoError(t, err)

	assert.Equal(t, math.MaxInt32, result.ActualQuotaAfterGroup, "oversized quota must clamp to int32 max, never wrap negative")
	require.NotNil(t, result.Clamp, "clamp event must be surfaced so it can be audited")
	assert.Equal(t, common.QuotaClampOverflow, result.Clamp.Kind)
	assert.Equal(t, math.MaxInt32, result.Clamp.Clamped)
}

// TestComputeTieredQuota_NoClampInRange confirms an in-range settlement leaves
// Clamp nil, so the audit path is a no-op in the common case.
func TestComputeTieredQuota_NoClampInRange(t *testing.T) {
	exprStr := `tier("base", p * 2 + c * 10)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   1.0,
		QuotaPerUnit: 500_000,
	}

	result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1000, C: 500})
	require.NoError(t, err)
	assert.Nil(t, result.Clamp, "in-range settlement must not report a clamp")
}

func TestComputeTieredQuotaBillingRateFallback(t *testing.T) {
	exprStr := `tier("base", p * 2 + c * 10)`
	tests := []struct {
		name      string
		rate      float64
		wantRate  float64
		wantQuota int
	}{
		{name: "historical snapshot defaults to one", rate: 0, wantRate: 1, wantQuota: 3500},
		{name: "negative rate defaults to one", rate: -1, wantRate: 1, wantQuota: 3500},
		{name: "nan rate defaults to one", rate: math.NaN(), wantRate: 1, wantQuota: 3500},
		{name: "infinite rate defaults to one", rate: math.Inf(1), wantRate: 1, wantQuota: 3500},
		{name: "configured rate is applied once", rate: 7.3, wantRate: 7.3, wantQuota: 25550},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snap := &billingexpr.BillingSnapshot{
				BillingMode:         "tiered_expr",
				ExprString:          exprStr,
				ExprHash:            billingexpr.ExprHashString(exprStr),
				GroupRatio:          1,
				QuotaPerUnit:        500_000,
				BillingUSDToCNYRate: tt.rate,
			}

			result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1000, C: 500})

			require.NoError(t, err)
			assert.Equal(t, tt.wantRate, snap.EffectiveBillingUSDToCNYRate())
			assert.Equal(t, tt.wantQuota, result.ActualQuotaAfterGroup)
		})
	}
}

func TestComputeTieredQuotaRejectsNegativeCharge(t *testing.T) {
	exprStr := `c == 123 ? tier("negative", -1000000) : tier("positive", p + c)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:         "tiered_expr",
		ExprString:          exprStr,
		ExprHash:            billingexpr.ExprHashString(exprStr),
		GroupRatio:          0.05,
		QuotaPerUnit:        500_000,
		BillingUSDToCNYRate: 7.3,
	}

	_, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1000, C: 123})

	require.ErrorContains(t, err, "invalid cost")
}

func TestComputeTieredQuotaRejectsNegativeGroupRatio(t *testing.T) {
	exprStr := `tier("base", p * 2 + c * 10)`
	snap := &billingexpr.BillingSnapshot{
		BillingMode:  "tiered_expr",
		ExprString:   exprStr,
		ExprHash:     billingexpr.ExprHashString(exprStr),
		GroupRatio:   -0.05,
		QuotaPerUnit: 500_000,
	}

	_, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{P: 1000, C: 500})

	require.ErrorContains(t, err, "invalid quota")
}
