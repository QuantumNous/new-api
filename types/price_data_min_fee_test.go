package types

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestModelGroupPricingMinFeeRoundTripWithRatio(t *testing.T) {
	ratio := 1.5
	fee := 0.05
	in := ModelGroupPricing{Ratio: &ratio, MinFee: &fee}

	raw, err := common.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out ModelGroupPricing
	if err := common.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Ratio == nil || *out.Ratio != 1.5 {
		t.Fatalf("ratio lost: %+v (raw=%s)", out.Ratio, raw)
	}
	if out.MinFee == nil || *out.MinFee != 0.05 {
		t.Fatalf("min_fee lost: %+v (raw=%s)", out.MinFee, raw)
	}
}

func TestModelGroupPricingHasMinFeeAndIsEmpty(t *testing.T) {
	fee := 0.02
	onlyMin := ModelGroupPricing{MinFee: &fee}
	if !onlyMin.HasMinFee() {
		t.Fatal("HasMinFee should be true")
	}
	if onlyMin.IsEmpty() {
		t.Fatal("a group with only MinFee must NOT be empty")
	}
	if (ModelGroupPricing{}).HasMinFee() {
		t.Fatal("empty pricing HasMinFee should be false")
	}
}
