package service

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestAutoCheapestGroupName(t *testing.T) {
	if AutoCheapestGroup != "default" {
		t.Fatalf("AutoCheapestGroup = %q, want default", AutoCheapestGroup)
	}
}

func TestRouteCandidateUserInputPriceUsesManualPublicPricing(t *testing.T) {
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"gpt-5.4":1.25}`); err != nil {
		t.Fatal(err)
	}
	setting := `{"manual_group_ratio":0.1,"model_price_ratio":0}`
	got, ok := routeCandidateUserInputPrice(pricedRouteCandidate{
		Setting:             &setting,
		RechargeRate:        0.146895,
		ApimasterPriceRatio: 3,
	}, "gpt-5.4", 2.5)
	if !ok {
		t.Fatal("expected price")
	}
	want := 0.11017125
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("price=%v want %v", got, want)
	}
}

func TestRouteCandidateInputPriceStoredRowWinsOverManualPublicPricing(t *testing.T) {
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"gpt-5.4":1.25}`); err != nil {
		t.Fatal(err)
	}
	setting := `{"manual_group_ratio":0.1,"model_price_ratio":0}`
	got, ok := routeCandidateInputPrice(pricedRouteCandidate{
		Setting:       &setting,
		InputPrice:    0.75,
		HasInputPrice: true,
	}, "gpt-5.4", 2.5)
	if !ok {
		t.Fatal("expected price")
	}
	if got != 0.75 {
		t.Fatalf("price=%v want 0.75", got)
	}
}

func TestMappedPricingRowOverridesCheaperCanonicalFallback(t *testing.T) {
	mapping := `{"gpt-image-2":"gpt-image-2-official"}`
	candidate := pricedRouteCandidate{ModelMapping: &mapping}

	applyPricedCandidateRow(&candidate, "gpt-image-2", "gpt-image-2", 0.0085)
	applyPricedCandidateRow(&candidate, "gpt-image-2", "gpt-image-2-official", 0.16872)

	if !candidate.HasMappedInputPrice {
		t.Fatal("expected mapped price to be resolved")
	}
	if candidate.InputPrice != 0.16872 {
		t.Fatalf("price=%v want mapped official price 0.16872", candidate.InputPrice)
	}
}

func TestPricedCandidateIgnoresUnrelatedModelRows(t *testing.T) {
	candidate := pricedRouteCandidate{}
	applyPricedCandidateRow(&candidate, "gpt-image-2", "unrelated-cheap-model", 0.00001)
	applyPricedCandidateRow(&candidate, "gpt-image-2", "gpt-image-2", 0.05)
	if candidate.InputPrice != 0.05 {
		t.Fatalf("price=%v want canonical price 0.05", candidate.InputPrice)
	}
}
