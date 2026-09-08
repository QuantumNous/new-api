package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentMoneyResponsesUseFixedDecimalStrings(t *testing.T) {
	response := AgentCreditAdjustmentResponse{
		Account: AgentCreditBalanceResponse{Balance: "1000.00"},
		Log: AgentCreditLogResponse{
			Delta:         "1000.00",
			BalanceBefore: "0.00",
			BalanceAfter:  "1000.00",
		},
	}

	raw, err := common.Marshal(response)
	require.NoError(t, err)
	encoded := string(raw)
	assert.Contains(t, encoded, `"balance":"1000.00"`)
	assert.Contains(t, encoded, `"delta":"1000.00"`)
	assert.Contains(t, encoded, `"balance_before":"0.00"`)
	assert.Contains(t, encoded, `"balance_after":"1000.00"`)
	assert.NotContains(t, encoded, `"balance":100000`)
	assert.NotContains(t, encoded, `"status"`)
	assert.NotContains(t, encoded, `"version"`)
	assert.NotContains(t, encoded, `"daily_code_limit"`)
}

func TestAgentPlanOfferDTOUsesDecimalStringAndPreservesValidityPresence(t *testing.T) {
	var omitted AgentPlanOfferUpsertRequest
	require.NoError(t, common.Unmarshal([]byte(`{"enabled":true,"unit_price":"60.00","refund_fee_bps":500}`), &omitted))
	assert.Equal(t, "60.00", omitted.UnitPrice)
	assert.Nil(t, omitted.CodeValidDays)

	var explicitZero AgentPlanOfferUpsertRequest
	require.NoError(t, common.Unmarshal([]byte(`{"enabled":true,"unit_price":"60.00","code_valid_days":0,"refund_fee_bps":500}`), &explicitZero))
	if assert.NotNil(t, explicitZero.CodeValidDays) {
		assert.Zero(t, *explicitZero.CodeValidDays)
	}

	response := AgentPlanOfferResponse{UnitPrice: "60.00"}
	raw, err := common.Marshal(response)
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"unit_price":"60.00"`)
	assert.NotContains(t, string(raw), `"unit_price":6000`)
}
