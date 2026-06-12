package model

import "testing"

func TestFormatPaymentMethodLabel(t *testing.T) {
	tests := []struct {
		method string
		want   string
	}{
		{PaymentMethodPayPal, "PayPal"},
		{PaymentMethodStripe, "Stripe"},
		{"alipay", "支付宝"},
		{"wxpay", "微信支付"},
		{PaymentMethodCreem, "Creem"},
		{"epay", "易支付"},
		{"", "未知"},
		{"custom_gateway", "custom_gateway"},
	}
	for _, tt := range tests {
		if got := FormatPaymentMethodLabel(tt.method); got != tt.want {
			t.Errorf("FormatPaymentMethodLabel(%q) = %q, want %q", tt.method, got, tt.want)
		}
	}
}
