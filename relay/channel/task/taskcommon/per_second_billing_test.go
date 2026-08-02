package taskcommon

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestExtractDurationSecondsFromJSON(t *testing.T) {
	raw := []byte(`{"code":"success","data":{"data":{"duration":4,"status":"succeeded"}}}`)
	if got := ExtractDurationSecondsFromJSON(raw); got != 4 {
		t.Fatalf("got %v want 4", got)
	}
	raw2 := []byte(`{"duration":"5"}`)
	if got := ExtractDurationSecondsFromJSON(raw2); got != 5 {
		t.Fatalf("got %v want 5", got)
	}
	if ExtractDurationSecondsFromJSON([]byte(`{}`)) != 0 {
		t.Fatal("empty should be 0")
	}
}

func TestQuotaFromPerSecondModelPrice(t *testing.T) {
	// 0.6 ¥/s * 4s * group 1 → 2.4 ¥
	got := QuotaFromPerSecondModelPrice(0.6, 4, 1, map[string]float64{"seconds": 1})
	want := int(math.Round(0.6 * 4 * common.QuotaPerUnit))
	if got != want {
		t.Fatalf("got %d want %d", got, want)
	}
	withRes := QuotaFromPerSecondModelPrice(0.6, 4, 1, map[string]float64{"seconds": 1, "resolution": 1.5})
	wantRes := int(math.Round(0.6 * 4 * 1.5 * common.QuotaPerUnit))
	if withRes != wantRes {
		t.Fatalf("got %d want %d", withRes, wantRes)
	}
}
