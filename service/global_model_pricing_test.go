package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestGlobalModelPricingUSD_minimax(t *testing.T) {
	jsonRatio := `{"minimax-m3":0.15}`
	if err := ratio_setting.UpdateModelRatioByJSONString(jsonRatio); err != nil {
		t.Fatal(err)
	}
	jsonComp := `{"minimax-m3":4}`
	if err := ratio_setting.UpdateCompletionRatioByJSONString(jsonComp); err != nil {
		t.Fatal(err)
	}
	jsonCache := `{"minimax-m3":0.2}`
	if err := ratio_setting.UpdateCacheRatioByJSONString(jsonCache); err != nil {
		t.Fatal(err)
	}

	in, out, cache, _, ok := GlobalModelPricingUSD("minimax-m3")
	if !ok {
		t.Fatal("expected ok")
	}
	if in != 0.3 {
		t.Fatalf("input=%v want 0.3", in)
	}
	if out != 1.2 {
		t.Fatalf("output=%v want 1.2", out)
	}
	if cache != 0.06 {
		t.Fatalf("cache=%v want 0.06", cache)
	}
}
