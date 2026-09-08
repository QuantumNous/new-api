package service

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseAgentPoints(t *testing.T) {
	for input, want := range map[string]int64{"0.01": 1, "1": 100, "1000.00": 100000} {
		got, err := ParseAgentPoints(input)
		require.NoError(t, err)
		assert.Equal(t, want, got)
	}
	for _, input := range []string{"", "-1", "+1", "1.001", "abc", "92233720368547758.08"} {
		_, err := ParseAgentPoints(input)
		assert.Error(t, err, input)
	}
}

func TestFormatAgentPoints(t *testing.T) {
	assert.Equal(t, "0.00", FormatAgentPoints(0))
	assert.Equal(t, "0.01", FormatAgentPoints(1))
	assert.Equal(t, "1.00", FormatAgentPoints(100))
	assert.Equal(t, "-1.00", FormatAgentPoints(-100))
	assert.Equal(t, "-92233720368547758.08", FormatAgentPoints(math.MinInt64))
}

func TestAgentPurchaseTotal(t *testing.T) {
	total, err := AgentPurchaseTotal(6000, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(60000), total)

	for _, input := range []struct {
		unitPrice int64
		quantity  int
	}{
		{unitPrice: -1, quantity: 1},
		{unitPrice: 1, quantity: 0},
		{unitPrice: 1, quantity: -1},
		{unitPrice: math.MaxInt64, quantity: 2},
	} {
		_, err := AgentPurchaseTotal(input.unitPrice, input.quantity)
		assert.Error(t, err)
	}
}

func TestAgentRefundAmount(t *testing.T) {
	fee, refund, err := AgentRefundAmount(6000, 500)
	require.NoError(t, err)
	assert.Equal(t, int64(300), fee)
	assert.Equal(t, int64(5700), refund)

	fee, refund, err = AgentRefundAmount(1, 5000)
	require.NoError(t, err)
	assert.Equal(t, int64(1), fee)
	assert.Equal(t, int64(0), refund)

	for _, input := range []struct {
		unitPrice int64
		feeBps    int
	}{
		{unitPrice: -1, feeBps: 0},
		{unitPrice: 1, feeBps: -1},
		{unitPrice: 1, feeBps: 10001},
	} {
		_, _, err := AgentRefundAmount(input.unitPrice, input.feeBps)
		assert.Error(t, err)
	}
}
