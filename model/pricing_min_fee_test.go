package model

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestSanitizeKeepsMinFee(t *testing.T) {
	fee := 0.05
	out, ok := sanitizeModelGroupPricingItem(types.ModelGroupPricing{MinFee: &fee})
	if !ok {
		t.Fatal("item with only MinFee should survive sanitize")
	}
	if out.MinFee == nil || *out.MinFee != 0.05 {
		t.Fatalf("MinFee not preserved: %+v", out.MinFee)
	}
}

func TestSanitizeDropsNegativeMinFee(t *testing.T) {
	fee := -1.0
	out, ok := sanitizeModelGroupPricingItem(types.ModelGroupPricing{MinFee: &fee})
	if ok || out.MinFee != nil {
		t.Fatalf("negative MinFee must be dropped, got ok=%v fee=%+v", ok, out.MinFee)
	}
}

func TestModelGroupPricingRatioViewKeepsMinFee(t *testing.T) {
	ratio := 1.5
	fee := 0.05
	view := modelGroupPricingRatioView(map[string]types.ModelGroupPricing{
		"vip": {Ratio: &ratio, MinFee: &fee},
	})
	if _, isItem := view["vip"].(types.ModelGroupPricing); !isItem {
		t.Fatalf("group with MinFee must stay a full item, got %T", view["vip"])
	}
}

func TestPricingStructExposesModelMinFeeField(t *testing.T) {
	p := Pricing{ModelMinFee: 0.05}
	if p.ModelMinFee != 0.05 {
		t.Fatalf("ModelMinFee field missing or wrong: %v", p.ModelMinFee)
	}
}
