package service

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestApplyMinFeeQuota(t *testing.T) {
	cases := []struct {
		name        string
		quota       int
		priceData   types.PriceData
		totalTokens int
		tiered      bool
		wantQuota   int
		wantApplied bool
	}{
		{"按量低于阈值抬升", 10000, types.PriceData{UsePrice: false, MinQuota: 25000}, 50, false, 25000, true},
		{"按量高于阈值不动", 30000, types.PriceData{UsePrice: false, MinQuota: 25000}, 50, false, 30000, false},
		{"未设最低费用不动", 10000, types.PriceData{UsePrice: false, MinQuota: 0}, 50, false, 10000, false},
		{"按次计费不触发", 10000, types.PriceData{UsePrice: true, MinQuota: 25000}, 50, false, 10000, false},
		{"阶梯计费不触发", 10000, types.PriceData{UsePrice: false, MinQuota: 25000}, 50, true, 10000, false},
		{"超时零token豁免", 0, types.PriceData{UsePrice: false, MinQuota: 25000}, 0, false, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, applied := applyMinFeeQuota(tc.quota, tc.priceData, tc.totalTokens, tc.tiered)
			if got != tc.wantQuota || applied != tc.wantApplied {
				t.Fatalf("got (%d,%v) want (%d,%v)", got, applied, tc.wantQuota, tc.wantApplied)
			}
		})
	}
}
