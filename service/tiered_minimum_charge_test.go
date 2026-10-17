package service

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A cheap per-token model: coefficients are $/1M-token prices, low enough that
// short requests land below one quota unit after the group ratio.
const cheapTieredExpr = `len <= 272000 ? tier("standard", p*0.0375 + c*0.1875 + cr*0.00375) : tier("long_context", p*0.075 + c*0.28125 + cr*0.0075)`

const (
	standardGroupRatio = 0.3478
	cheaperGroupRatio  = 0.2319
)

// A priced request must never settle at zero just because its cost rounded
// below one quota unit. The ratio path enforces this; tiered billing carries no
// model ratio, so it needs its own equivalent guard.
func TestApplyTieredMinimumCharge(t *testing.T) {
	cases := []struct {
		name       string
		quota      int
		billable   bool
		groupRatio float64
		result     *billingexpr.TieredResult
		want       int
	}{
		{
			name:       "priced request rounding below one quota is lifted to one",
			quota:      0,
			billable:   true,
			groupRatio: standardGroupRatio,
			result:     &billingexpr.TieredResult{ActualQuotaBeforeGroup: 0.9},
			want:       1,
		},
		{
			name:       "expression priced at zero stays free",
			quota:      0,
			billable:   true,
			groupRatio: standardGroupRatio,
			result:     &billingexpr.TieredResult{ActualQuotaBeforeGroup: 0},
			want:       0,
		},
		{
			name:       "free group stays free",
			quota:      0,
			billable:   true,
			groupRatio: 0,
			result:     &billingexpr.TieredResult{ActualQuotaBeforeGroup: 12},
			want:       0,
		},
		{
			name:       "request with no billable usage is not charged",
			quota:      0,
			billable:   false,
			groupRatio: standardGroupRatio,
			result:     &billingexpr.TieredResult{ActualQuotaBeforeGroup: 12},
			want:       0,
		},
		{
			name:       "expression error fallback is left untouched",
			quota:      0,
			billable:   true,
			groupRatio: standardGroupRatio,
			result:     nil,
			want:       0,
		},
		{
			name:       "charge of one or more is untouched",
			quota:      25,
			billable:   true,
			groupRatio: standardGroupRatio,
			result:     &billingexpr.TieredResult{ActualQuotaBeforeGroup: 216.9},
			want:       25,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, applyTieredMinimumCharge(tc.quota, tc.billable, tc.groupRatio, tc.result))
		})
	}
}

// Regression: on a cheap model, real completions settled at zero quota because
// the per-request charge rounds below one quota unit. The ratio path lifts those
// to 1; tiered billing must not silently serve them for free.
func TestTieredSettleChargesShortRequestsOnCheapModel(t *testing.T) {
	cases := []struct {
		name         string
		groupRatio   float64
		promptTokens float64
		completion   float64
		wantSettled  int
		wantCharged  int
	}{
		{
			name:         "short request settles at zero without the minimum",
			groupRatio:   standardGroupRatio,
			promptTokens: 7,
			completion:   13,
			wantSettled:  0,
			wantCharged:  1,
		},
		{
			name:         "short request on a cheaper group settles at zero too",
			groupRatio:   cheaperGroupRatio,
			promptTokens: 13,
			completion:   5,
			wantSettled:  0,
			wantCharged:  1,
		},
		{
			name:         "ordinary request is unaffected by the minimum",
			groupRatio:   cheaperGroupRatio,
			promptTokens: 5724,
			completion:   12,
			wantSettled:  25,
			wantCharged:  25,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			snap := makeSnapshot(cheapTieredExpr, tc.groupRatio, int(tc.promptTokens), int(tc.completion))
			result, err := billingexpr.ComputeTieredQuota(snap, billingexpr.TokenParams{
				P:   tc.promptTokens,
				C:   tc.completion,
				Len: tc.promptTokens,
			})
			require.NoError(t, err)
			require.Equal(t, "standard", result.MatchedTier)

			assert.Equal(t, tc.wantSettled, result.ActualQuotaAfterGroup, "raw settlement")
			assert.Equal(t, tc.wantCharged,
				applyTieredMinimumCharge(result.ActualQuotaAfterGroup, true, tc.groupRatio, &result),
				"charge after the minimum")
		})
	}
}
