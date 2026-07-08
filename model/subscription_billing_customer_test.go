package model

import "testing"

func TestSaveAndGetAirwallexBillingCustomerId(t *testing.T) {
	if err := DB.AutoMigrate(&AirwallexBillingCustomer{}); err != nil {
		t.Fatal(err)
	}
	if got := GetAirwallexBillingCustomerId(4242); got != "" {
		t.Fatalf("expected empty, got %s", got)
	}
	if err := SaveAirwallexBillingCustomerId(4242, "bcus_a"); err != nil {
		t.Fatal(err)
	}
	if got := GetAirwallexBillingCustomerId(4242); got != "bcus_a" {
		t.Fatalf("want bcus_a, got %s", got)
	}
	// Upsert: second save replaces, does not duplicate.
	if err := SaveAirwallexBillingCustomerId(4242, "bcus_b"); err != nil {
		t.Fatal(err)
	}
	if got := GetAirwallexBillingCustomerId(4242); got != "bcus_b" {
		t.Fatalf("want bcus_b after upsert, got %s", got)
	}
}
