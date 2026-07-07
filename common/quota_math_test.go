package common

import (
	"math"
	"testing"
)

func TestQuotaFromFloatSaturatesUnsafeValues(t *testing.T) {
	if got := QuotaFromFloat(math.NaN()); got != 0 {
		t.Fatalf("NaN quota = %d, want 0", got)
	}
	if got := QuotaFromFloat(math.MaxFloat64); got != math.MaxInt32 {
		t.Fatalf("huge quota = %d, want MaxInt32", got)
	}
	if got := QuotaFromFloat(-math.MaxFloat64); got != math.MinInt32 {
		t.Fatalf("negative huge quota = %d, want MinInt32", got)
	}
}
