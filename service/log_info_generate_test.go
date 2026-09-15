package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInjectTieredBillingInfoAddsSettlementTrace(t *testing.T) {
	other := map[string]interface{}{}
	relayInfo := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			ExprString: `tier("base", p * 2 + c * 10)`,
		},
	}
	result := &billingexpr.TieredResult{
		ActualUsage:           billingexpr.TokenParams{P: 5, C: 16},
		ActualCostBeforeGroup: 0.00017,
		MatchedTier:           "base",
	}

	InjectTieredBillingInfo(other, relayInfo, result)

	assert.Equal(t, result.ActualUsage, other["billing_usage"])
	assert.Equal(t, 0.00017, other["billing_cost_before_group"])
	assert.Equal(t, "base", other["matched_tier"])
	assert.NotEmpty(t, other["expr_b64"])

	encoded, err := common.Marshal(other)
	require.NoError(t, err)
	var decoded map[string]interface{}
	require.NoError(t, common.Unmarshal(encoded, &decoded))
	usage, ok := decoded["billing_usage"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, 5.0, usage["p"])
	assert.Equal(t, 16.0, usage["c"])
	assert.NotContains(t, usage, "P")
	assert.Equal(t, 0.00017, decoded["billing_cost_before_group"])
}
