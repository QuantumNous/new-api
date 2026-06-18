package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

func TestMinFeeToQuota(t *testing.T) {
	// 期望值锚定 QuotaPerUnit=500000，若该常量变动需重算（避免浮点 vs decimal 边界不等）。
	if common.QuotaPerUnit != 500000 {
		t.Fatalf("test assumes QuotaPerUnit=500000, got %v", common.QuotaPerUnit)
	}
	if got := minFeeToQuota(0.05, 1.0); got != 25000 { // $0.05 * 500000 * 1.0
		t.Fatalf("want 25000, got %d", got)
	}
	if got := minFeeToQuota(0.05, 0.8); got != 20000 { // $0.05 * 500000 * 0.8
		t.Fatalf("want 20000, got %d", got)
	}
	if minFeeToQuota(0, 1.0) != 0 || minFeeToQuota(-1, 1.0) != 0 {
		t.Fatal("non-positive fee must yield 0")
	}
}

func TestComputeMinQuotaPrefersGroupForcedOverModel(t *testing.T) {
	groupFee := 0.10
	override := &types.ModelGroupPricing{MinFee: &groupFee}
	// 分组强制 $0.10，不乘倍率，即便倍率 0.5 -> 0.10 * 500000 = 50000
	got := computeMinQuota(override, "any-model-without-model-min-fee", 0.5)
	if got != 50000 {
		t.Fatalf("group forced min must ignore ratio: want 50000 got %d", got)
	}
}
