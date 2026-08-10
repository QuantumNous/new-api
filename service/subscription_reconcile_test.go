package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/airwallex"
)

func truncateSubscriptionTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM user_subscriptions")
		model.DB.Exec("DELETE FROM airwallex_billing_customers")
	})
}

func withStubbedAirwallex(t *testing.T, fn func(customerId string) ([]airwallex.BillingSubscription, error)) {
	t.Helper()
	orig := listActiveBillingSubscriptions
	listActiveBillingSubscriptions = fn
	t.Cleanup(func() { listActiveBillingSubscriptions = orig })
}

func seedRenewingSub(t *testing.T, userId int, customerId string) *model.UserSubscription {
	t.Helper()
	now := common.GetTimestamp()
	sub := &model.UserSubscription{UserId: userId, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus", Source: "order"}
	if err := model.DB.Create(sub).Error; err != nil {
		t.Fatal(err)
	}
	if customerId != "" {
		if err := model.SaveAirwallexBillingCustomerId(userId, customerId); err != nil {
			t.Fatal(err)
		}
	}
	return sub
}

func cancelledAt(t *testing.T, id int) int64 {
	t.Helper()
	var got model.UserSubscription
	if err := model.DB.First(&got, id).Error; err != nil {
		t.Fatal(err)
	}
	return got.CancelledAt
}

func TestReconcileMarksCustomerWithNoActiveSubscription(t *testing.T) {
	truncateSubscriptionTables(t)
	sub := seedRenewingSub(t, 7, "bcus_gone")

	withStubbedAirwallex(t, func(string) ([]airwallex.BillingSubscription, error) {
		return nil, nil // cancelled subscriptions leave the ACTIVE set immediately
	})

	n, err := ReconcileAirwallexCancellations(100)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("marked %d users, want 1", n)
	}
	if cancelledAt(t, sub.Id) == 0 {
		t.Fatal("row should have been marked cancelled")
	}
}

func TestReconcileLeavesLiveSubscriptionAlone(t *testing.T) {
	truncateSubscriptionTables(t)
	sub := seedRenewingSub(t, 7, "bcus_live")

	withStubbedAirwallex(t, func(string) ([]airwallex.BillingSubscription, error) {
		return []airwallex.BillingSubscription{{Id: "sub_1", Status: "ACTIVE"}}, nil
	})

	if _, err := ReconcileAirwallexCancellations(100); err != nil {
		t.Fatal(err)
	}
	if got := cancelledAt(t, sub.Id); got != 0 {
		t.Fatalf("cancelled_at = %d, want 0 — a live subscription must not be marked", got)
	}
}

func TestReconcileDoesNotMarkOnApiError(t *testing.T) {
	truncateSubscriptionTables(t)
	sub := seedRenewingSub(t, 7, "bcus_err")

	withStubbedAirwallex(t, func(string) ([]airwallex.BillingSubscription, error) {
		return nil, errors.New("airwallex unavailable")
	})

	n, err := ReconcileAirwallexCancellations(100)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("marked %d users during an outage, want 0", n)
	}
	// The whole pass reasons from evidence. An API error is the absence of
	// evidence, not evidence of absence — marking here would cancel every live
	// subscription in the system during an Airwallex outage.
	if got := cancelledAt(t, sub.Id); got != 0 {
		t.Fatalf("cancelled_at = %d, want 0 — an API error must never mark a row", got)
	}
}

func TestReconcileSkipsUsersWithNoAirwallexCustomer(t *testing.T) {
	truncateSubscriptionTables(t)
	sub := seedRenewingSub(t, 7, "") // paid another way, or predates the mapping

	called := false
	withStubbedAirwallex(t, func(string) ([]airwallex.BillingSubscription, error) {
		called = true
		return nil, nil
	})

	if _, err := ReconcileAirwallexCancellations(100); err != nil {
		t.Fatal(err)
	}
	if called {
		t.Fatal("should not query Airwallex for a user with no billing customer")
	}
	if got := cancelledAt(t, sub.Id); got != 0 {
		t.Fatalf("cancelled_at = %d, want 0", got)
	}
}

func TestReconcileQueriesEachCustomerOnce(t *testing.T) {
	truncateSubscriptionTables(t)
	seedRenewingSub(t, 7, "bcus_dup")
	seedRenewingSub(t, 7, "bcus_dup") // same user, second row

	calls := 0
	withStubbedAirwallex(t, func(string) ([]airwallex.BillingSubscription, error) {
		calls++
		return nil, nil
	})

	if _, err := ReconcileAirwallexCancellations(100); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("made %d Airwallex calls for one user, want 1", calls)
	}
}
