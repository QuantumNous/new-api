package billingexpr_test

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComputeTieredQuotaReturnsActualUsageAndCost(t *testing.T) {
	expression := `tier("base", p * 2 + c * 10 + cr * 0.2 + cc * 4) * 2`
	params := billingexpr.TokenParams{P: 5, C: 16, CR: 200, CC: 7}
	snapshot := &billingexpr.BillingSnapshot{
		ExprString:   expression,
		ExprHash:     billingexpr.ExprHashString(expression),
		GroupRatio:   0.5,
		QuotaPerUnit: 500000,
		ExprVersion:  1,
	}

	result, err := billingexpr.ComputeTieredQuota(snapshot, params)

	require.NoError(t, err)
	assert.Equal(t, params, result.ActualUsage)
	assert.InDelta(t, 0.000476, result.ActualCostBeforeGroup, 1e-12)
	assert.InDelta(t, 238, result.ActualQuotaBeforeGroup, 1e-9)
	assert.Equal(t, 119, result.ActualQuotaAfterGroup)
}
