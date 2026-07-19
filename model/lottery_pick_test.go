package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestWeightedPickRespectsWeights(t *testing.T) {
	prizes := []operation_setting.LotteryPrize{
		{Name: "a", Weight: 1},
		{Name: "b", Weight: 99},
	}
	lotteryRandIntn = func(n int) int { return 0 }
	if got := weightedPick(prizes); got != 0 {
		t.Fatalf("want 0, got %d", got)
	}
	lotteryRandIntn = func(n int) int { return 1 }
	if got := weightedPick(prizes); got != 1 {
		t.Fatalf("want 1, got %d", got)
	}
}

func TestPickLotteryPrizePity(t *testing.T) {
	setting := &operation_setting.LotterySetting{
		FreePrizes: []operation_setting.LotteryPrize{
			{Name: "thanks", Usd: 0, Weight: 100, IsThanks: true},
			{Name: "small", Usd: 0.01, Weight: 1},
			{Name: "big", Usd: 1, Weight: 1},
		},
		BetPrizes: []operation_setting.LotteryPrize{
			{Name: "thanks", Multiplier: 0, Weight: 100, IsThanks: true},
			{Name: "small", Multiplier: 0.2, Weight: 1},
			{Name: "big", Multiplier: 2, Weight: 1},
		},
	}
	idx, prize, delta, isThanks, isPity := pickLotteryPrize(setting, 0, false, true)
	wantDelta := operation_setting.UsdToQuota(0.01)
	if !isPity || isThanks || prize.Usd != 0.01 || delta != wantDelta || idx != 1 {
		t.Fatalf("pity free failed: idx=%d prize=%+v delta=%d thanks=%v pity=%v", idx, prize, delta, isThanks, isPity)
	}

	idx, prize, delta, isThanks, isPity = pickLotteryPrize(setting, 1000, false, true)
	if !isPity || isThanks || prize.Multiplier != 0.2 || delta != 200 {
		t.Fatalf("pity bet failed: idx=%d prize=%+v delta=%d thanks=%v pity=%v", idx, prize, delta, isThanks, isPity)
	}
}

func TestPickLotteryPrizeThursdayFreeAmount(t *testing.T) {
	setting := &operation_setting.LotterySetting{
		FreePrizes: []operation_setting.LotteryPrize{
			{Name: "mid", Usd: 0.5, Weight: 1},
		},
	}
	lotteryRandIntn = func(n int) int { return 0 }
	_, _, delta, _, _ := pickLotteryPrize(setting, 0, true, false)
	want := operation_setting.UsdToQuota(1)
	if delta != want {
		t.Fatalf("thursday free amount want %d, got %d", want, delta)
	}
}
