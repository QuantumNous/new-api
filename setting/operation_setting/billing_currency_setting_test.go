package operation_setting

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetBillingUSDToCNYRateFallsBackForInvalidValues(t *testing.T) {
	original := BillingUSDToCNYRate
	t.Cleanup(func() {
		BillingUSDToCNYRate = original
	})

	tests := []struct {
		name string
		rate float64
		want float64
	}{
		{name: "configured rate", rate: 7.3, want: 7.3},
		{name: "zero defaults to one", rate: 0, want: 1},
		{name: "negative defaults to one", rate: -1, want: 1},
		{name: "nan defaults to one", rate: math.NaN(), want: 1},
		{name: "positive infinity defaults to one", rate: math.Inf(1), want: 1},
		{name: "negative infinity defaults to one", rate: math.Inf(-1), want: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			BillingUSDToCNYRate = tt.rate
			assert.Equal(t, tt.want, GetBillingUSDToCNYRate())
		})
	}
}
