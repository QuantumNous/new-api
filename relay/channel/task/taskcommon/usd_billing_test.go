package taskcommon

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestQuotaFromUSDCost(t *testing.T) {
	common.QuotaPerUnit = 500000
	got := QuotaFromUSDCost(0.105, 1, 1)
	want := 52500
	if got != want {
		t.Fatalf("QuotaFromUSDCost(0.105,1,1)=%d want %d", got, want)
	}
	gotMult := QuotaFromUSDCost(0.105, 1, 7.3)
	wantMult := 383250
	if gotMult != wantMult {
		t.Fatalf("QuotaFromUSDCost(0.105,1,7.3)=%d want %d", gotMult, wantMult)
	}
	if QuotaFromUSDCost(0, 1, 1) != 0 {
		t.Fatal("zero cost should return 0")
	}
}

func TestExtractUSDFromJSON(t *testing.T) {
	raw := []byte(`{"code":200,"data":{"cost":0.105,"status":"completed"}}`)
	if v := ExtractUSDFromJSON(raw); v != 0.105 {
		t.Fatalf("got %v want 0.105", v)
	}
}
