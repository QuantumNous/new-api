package model

import "testing"

func TestGetSubscriptionPlanByAirwallexPriceId(t *testing.T) {
	truncateTables(t)

	monthly := &SubscriptionPlan{Title: "Plus", PriceAmount: 20, Currency: "CNY",
		DurationUnit: SubscriptionDurationMonth, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_plus_month", Enabled: true}
	if err := DB.Create(monthly).Error; err != nil {
		t.Fatal(err)
	}
	yearly := &SubscriptionPlan{Title: "Plus 年付", PriceAmount: 204, Currency: "CNY",
		DurationUnit: SubscriptionDurationYear, DurationValue: 1,
		UpgradeGroup: "plus", AirwallexPriceId: "pri_plus_year", Enabled: true}
	if err := DB.Create(yearly).Error; err != nil {
		t.Fatal(err)
	}

	got, err := GetSubscriptionPlanByAirwallexPriceId("pri_plus_year")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Id != yearly.Id {
		t.Fatalf("want plan %d, got %+v", yearly.Id, got)
	}

	missing, err := GetSubscriptionPlanByAirwallexPriceId("pri_nope")
	if err != nil {
		t.Fatalf("unknown price must not error: %v", err)
	}
	if missing != nil {
		t.Fatalf("want nil for unknown price, got %+v", missing)
	}

	empty, err := GetSubscriptionPlanByAirwallexPriceId("")
	if err != nil {
		t.Fatalf("empty price must not error: %v", err)
	}
	if empty != nil {
		t.Fatalf("want nil for empty price, got %+v", empty)
	}
}
