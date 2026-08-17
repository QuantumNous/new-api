package operation_setting

import "testing"

func TestGetAmountDiscount(t *testing.T) {
	p := &PaymentSetting{
		AmountDiscount:      map[int]float64{20: 0.9, 50: 0.8},
		EnableRangeDiscount: true,
	}
	cases := []struct {
		amount int
		want   float64
	}{
		{10, 1.0},  // 低于最低档位，无折扣
		{20, 0.9},  // 精确命中
		{21, 0.9},  // 区间：按 20 档
		{35, 0.9},  // 区间：按 20 档
		{49, 0.9},  // 区间：按 20 档
		{50, 0.8},  // 精确命中
		{60, 0.8},  // 区间：按 50 档
		{100, 0.8}, // 区间：按 50 档
	}
	for _, c := range cases {
		if got := p.GetAmountDiscount(c.amount); got != c.want {
			t.Errorf("EnableRangeDiscount=true amount=%d: got %v, want %v", c.amount, got, c.want)
		}
	}

	// 关闭区间折扣：仅精确匹配
	p.EnableRangeDiscount = false
	casesExact := []struct {
		amount int
		want   float64
	}{
		{20, 0.9},
		{21, 1.0},
		{35, 1.0},
		{50, 0.8},
		{60, 1.0},
	}
	for _, c := range casesExact {
		if got := p.GetAmountDiscount(c.amount); got != c.want {
			t.Errorf("EnableRangeDiscount=false amount=%d: got %v, want %v", c.amount, got, c.want)
		}
	}

	// 空配置兜底
	empty := &PaymentSetting{}
	for _, amount := range []int{1, 20, 100} {
		if got := empty.GetAmountDiscount(amount); got != 1.0 {
			t.Errorf("empty config amount=%d: got %v, want 1.0", amount, got)
		}
	}
}
