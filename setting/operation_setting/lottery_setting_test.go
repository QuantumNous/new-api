package operation_setting

import "testing"

func TestEffectiveDailyPoolUSDThursday(t *testing.T) {
	if got := EffectiveDailyPoolUSD(100, false); got != 100 {
		t.Fatalf("want 100, got %v", got)
	}
	if got := EffectiveDailyPoolUSD(100, true); got != 200 {
		t.Fatalf("want 200, got %v", got)
	}
}

func TestEffectiveFreeUSDThursday(t *testing.T) {
	if got := EffectiveFreeUSD(0.5, true); got != 1 {
		t.Fatalf("want 1, got %v", got)
	}
	if got := EffectiveFreeUSD(0, true); got != 0 {
		t.Fatalf("want 0, got %v", got)
	}
}

func TestUsdToQuota(t *testing.T) {
	// default QuotaPerUnit is 500000
	if got := UsdToQuota(1); got != 500000 {
		t.Fatalf("want 500000, got %d", got)
	}
	if got := UsdToQuota(0.01); got != 5000 {
		t.Fatalf("want 5000, got %d", got)
	}
}

func TestRoundBetDelta(t *testing.T) {
	if got := RoundBetDelta(1000, 2); got != 2000 {
		t.Fatalf("want 2000, got %d", got)
	}
	if got := RoundBetDelta(1000, -1); got != -1000 {
		t.Fatalf("want -1000, got %d", got)
	}
}

func TestValidateLotterySetting(t *testing.T) {
	s := GetLotterySetting()
	if err := ValidateLotterySetting(s); err != nil {
		t.Fatalf("default setting should be valid: %v", err)
	}
	bad := *s
	bad.BetPrizes = []LotteryPrize{{Name: "x", Multiplier: 3, Weight: 1}}
	if err := ValidateLotterySetting(&bad); err == nil {
		t.Fatal("expected multiplier > 2 to fail")
	}
}
