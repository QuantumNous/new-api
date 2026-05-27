package airwallex

import "testing"

func TestFilterMethodsUsesAirwallexTypeIdentifier(t *testing.T) {
	items := []PaymentMethodType{
		{Name: "alipay", Type: "alipaycn"},
		{Name: "Card", Type: "card"},
	}

	filtered := filterMethods(items, []string{"alipaycn"})

	if len(filtered) != 1 {
		t.Fatalf("expected one filtered method, got %#v", filtered)
	}
	if filtered[0].Type != "alipaycn" {
		t.Fatalf("expected Airwallex method type alipaycn, got %#v", filtered[0])
	}
}
