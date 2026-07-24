package operation_setting

import "testing"

// 保存/恢复全局 paymentSetting，避免污染其它用例。
func withPaymentSetting(s PaymentSetting, fn func()) {
	old := paymentSetting
	paymentSetting = s
	defer func() { paymentSetting = old }()
	fn()
}

// TC-E-GIFT-01：命中最高满足档位。
func TestCalcTopupGift_HitHighestTier(t *testing.T) {
	withPaymentSetting(PaymentSetting{
		GiftEnabled: true,
		GiftRules: []TopupGiftRule{
			{Threshold: 100, Gift: 8},
			{Threshold: 500, Gift: 50},
			{Threshold: 1000, Gift: 120},
		},
	}, func() {
		cases := []struct {
			principal int
			want      int
		}{
			{principal: 50, want: 0},    // 未达最低档
			{principal: 100, want: 8},   // 恰好第一档
			{principal: 300, want: 8},   // 第一档与第二档之间
			{principal: 500, want: 50},  // 恰好第二档
			{principal: 999, want: 50},  // 第二档与第三档之间
			{principal: 1000, want: 120}, // 恰好第三档
			{principal: 5000, want: 120}, // 超过最高档，仍取最高档
		}
		for _, c := range cases {
			if got := CalcTopupGift(c.principal); got != c.want {
				t.Errorf("CalcTopupGift(%d) = %d, want %d", c.principal, got, c.want)
			}
		}
	})
}

// TC-E-GIFT-02：未启用赠送 => 恒 0。
func TestCalcTopupGift_Disabled(t *testing.T) {
	withPaymentSetting(PaymentSetting{
		GiftEnabled: false,
		GiftRules:   []TopupGiftRule{{Threshold: 100, Gift: 8}},
	}, func() {
		if got := CalcTopupGift(1000); got != 0 {
			t.Errorf("disabled gift should return 0, got %d", got)
		}
	})
}

// TC-E-GIFT-03：无规则 / 非正本金 => 0；乱序规则也能命中最高满足档。
func TestCalcTopupGift_EdgeCases(t *testing.T) {
	withPaymentSetting(PaymentSetting{GiftEnabled: true, GiftRules: nil}, func() {
		if got := CalcTopupGift(1000); got != 0 {
			t.Errorf("no rules should return 0, got %d", got)
		}
	})
	withPaymentSetting(PaymentSetting{
		GiftEnabled: true,
		GiftRules: []TopupGiftRule{
			{Threshold: 1000, Gift: 120},
			{Threshold: 100, Gift: 8}, // 乱序
			{Threshold: 500, Gift: 50},
		},
	}, func() {
		if got := CalcTopupGift(0); got != 0 {
			t.Errorf("non-positive principal should return 0, got %d", got)
		}
		if got := CalcTopupGift(700); got != 50 {
			t.Errorf("unsorted rules: CalcTopupGift(700) = %d, want 50", got)
		}
	})
}

// TC-E-GIFT-04：有效天数 —— <=0 返回 0（不过期）。
func TestGetTopupGiftValidDays(t *testing.T) {
	withPaymentSetting(PaymentSetting{GiftValidDays: 0}, func() {
		if got := GetTopupGiftValidDays(); got != 0 {
			t.Errorf("valid days 0 => 0, got %d", got)
		}
	})
	withPaymentSetting(PaymentSetting{GiftValidDays: 30}, func() {
		if got := GetTopupGiftValidDays(); got != 30 {
			t.Errorf("valid days 30 => 30, got %d", got)
		}
	})
}

// 签到有效天数：<=0 回退默认 7。
func TestGetCheckinValidDays(t *testing.T) {
	old := checkinSetting
	defer func() { checkinSetting = old }()
	checkinSetting.ValidDays = 0
	if got := GetCheckinValidDays(); got != 7 {
		t.Errorf("checkin valid days 0 => default 7, got %d", got)
	}
	checkinSetting.ValidDays = 14
	if got := GetCheckinValidDays(); got != 14 {
		t.Errorf("checkin valid days 14 => 14, got %d", got)
	}
}
