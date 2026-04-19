package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestIsNonEpayPaymentMethodForEpayCallback(t *testing.T) {
	testCases := []struct {
		name            string
		paymentMethod   string
		expectedBlocked bool
	}{
		{name: "stripe", paymentMethod: model.PaymentMethodStripe, expectedBlocked: true},
		{name: "creem", paymentMethod: model.PaymentMethodCreem, expectedBlocked: true},
		{name: "waffo", paymentMethod: model.PaymentMethodWaffo, expectedBlocked: true},
		{name: "waffo pancake", paymentMethod: model.PaymentMethodWaffoPancake, expectedBlocked: true},
		{name: "alipay", paymentMethod: "alipay", expectedBlocked: false},
		{name: "wxpay", paymentMethod: "wxpay", expectedBlocked: false},
		{name: "custom epay type", paymentMethod: "custom1", expectedBlocked: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if actual := isNonEpayPaymentMethodForEpayCallback(tc.paymentMethod); actual != tc.expectedBlocked {
				t.Fatalf("expected blocked=%v, got %v for payment method %q", tc.expectedBlocked, actual, tc.paymentMethod)
			}
		})
	}
}
