package controller

import "testing"

func TestNormalizeSubscriptionPlanCurrency(t *testing.T) {
	testCases := []struct {
		name     string
		currency string
		valid    bool
	}{
		{name: "defaults empty currency to USD", currency: "", valid: true},
		{name: "accepts USD", currency: "USD", valid: true},
		{name: "accepts case insensitive USD", currency: " usd ", valid: true},
		{name: "rejects CNY", currency: "CNY", valid: false},
		{name: "rejects other currencies", currency: "EUR", valid: false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			currency, valid := normalizeSubscriptionPlanCurrency(testCase.currency)
			if valid != testCase.valid {
				t.Fatalf("normalizeSubscriptionPlanCurrency(%q) valid = %t, want %t", testCase.currency, valid, testCase.valid)
			}
			if valid && currency != "USD" {
				t.Fatalf("normalizeSubscriptionPlanCurrency(%q) currency = %q, want USD", testCase.currency, currency)
			}
		})
	}
}

func TestIsUSDSubscriptionCurrency(t *testing.T) {
	if !isUSDSubscriptionCurrency(" USD ") {
		t.Fatal("expected USD to be accepted")
	}
	if isUSDSubscriptionCurrency("CNY") {
		t.Fatal("expected CNY to be rejected")
	}
}
