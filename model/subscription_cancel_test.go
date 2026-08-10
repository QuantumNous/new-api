package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestMarkUserSubscriptionsCancelled(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	live := &UserSubscription{UserId: 7, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus", Source: "order"}
	if err := DB.Create(live).Error; err != nil {
		t.Fatal(err)
	}
	// Already expired: cancelling auto-renewal says nothing about a term that
	// has already ended, and rewriting history here would confuse support.
	old := &UserSubscription{UserId: 7, PlanId: 1, Status: "expired",
		StartTime: now - 200, EndTime: now - 100, UpgradeGroup: "plus", Source: "order"}
	if err := DB.Create(old).Error; err != nil {
		t.Fatal(err)
	}
	other := &UserSubscription{UserId: 8, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus", Source: "order"}
	if err := DB.Create(other).Error; err != nil {
		t.Fatal(err)
	}

	n, err := MarkUserSubscriptionsCancelled(7, now)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected 1 row marked, got %d", n)
	}

	var got UserSubscription
	if err := DB.First(&got, live.Id).Error; err != nil {
		t.Fatal(err)
	}
	if got.CancelledAt != now {
		t.Fatalf("cancelled_at = %d, want %d", got.CancelledAt, now)
	}
	// Access must survive cancellation: the customer paid through EndTime.
	if got.Status != "active" {
		t.Fatalf("status = %q, want it left active — cancelling must not revoke the paid-for remainder", got.Status)
	}
	if got.EndTime != live.EndTime {
		t.Fatalf("end_time moved from %d to %d", live.EndTime, got.EndTime)
	}

	var untouchedExpired, untouchedOther UserSubscription
	if err := DB.First(&untouchedExpired, old.Id).Error; err != nil {
		t.Fatal(err)
	}
	if untouchedExpired.CancelledAt != 0 {
		t.Fatal("an already-expired row must not be marked")
	}
	if err := DB.First(&untouchedOther, other.Id).Error; err != nil {
		t.Fatal(err)
	}
	if untouchedOther.CancelledAt != 0 {
		t.Fatal("another user's row must not be marked")
	}
}

func TestMarkUserSubscriptionsCancelledIsIdempotent(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	sub := &UserSubscription{UserId: 7, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus", Source: "order"}
	if err := DB.Create(sub).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := MarkUserSubscriptionsCancelled(7, now); err != nil {
		t.Fatal(err)
	}
	// A duplicate webhook, an endpoint retry, and the reconcile pass all land
	// on the same row. The second write must be a no-op that preserves the
	// original cancellation time rather than sliding it forward.
	n, err := MarkUserSubscriptionsCancelled(7, now+500)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("second mark affected %d rows, want 0", n)
	}

	var got UserSubscription
	if err := DB.First(&got, sub.Id).Error; err != nil {
		t.Fatal(err)
	}
	if got.CancelledAt != now {
		t.Fatalf("cancelled_at = %d, want the first value %d", got.CancelledAt, now)
	}
}

func TestListRenewingUserSubscriptions(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	renewing := &UserSubscription{UserId: 7, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus", Source: "order"}
	cancelled := &UserSubscription{UserId: 8, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus", Source: "order", CancelledAt: now}
	expired := &UserSubscription{UserId: 9, PlanId: 1, Status: "expired",
		StartTime: now - 200, EndTime: now - 100, UpgradeGroup: "plus", Source: "order"}
	// A comped account has no Airwallex subscription to find, so it looks
	// exactly like a cancelled one to the reconcile. It must never be a
	// candidate.
	granted := &UserSubscription{UserId: 10, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "pro", Source: "admin"}
	for _, s := range []*UserSubscription{renewing, cancelled, expired, granted} {
		if err := DB.Create(s).Error; err != nil {
			t.Fatal(err)
		}
	}

	got, err := ListRenewingUserSubscriptions(100)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d candidates, want 1", len(got))
	}
	if got[0].UserId != 7 {
		t.Fatalf("candidate user = %d, want 7", got[0].UserId)
	}
}

func TestGetUserIdByAirwallexBillingCustomerId(t *testing.T) {
	truncateTables(t)
	if err := SaveAirwallexBillingCustomerId(42, "bcus_test_1"); err != nil {
		t.Fatal(err)
	}
	if got := GetUserIdByAirwallexBillingCustomerId("bcus_test_1"); got != 42 {
		t.Fatalf("got user %d, want 42", got)
	}
	if got := GetUserIdByAirwallexBillingCustomerId("bcus_unknown"); got != 0 {
		t.Fatalf("unknown customer returned user %d, want 0", got)
	}
	if got := GetUserIdByAirwallexBillingCustomerId(""); got != 0 {
		t.Fatalf("empty customer returned user %d, want 0", got)
	}
}

func TestHasRenewingUserSubscription(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	mk := func(userId int, over func(*UserSubscription)) {
		s := &UserSubscription{UserId: userId, PlanId: 1, Status: "active", Source: "order",
			StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus"}
		if over != nil {
			over(s)
		}
		if err := DB.Create(s).Error; err != nil {
			t.Fatal(err)
		}
	}

	mk(7, nil)                                                        // renewing
	mk(8, func(s *UserSubscription) { s.CancelledAt = now })          // cancelled, still running
	mk(9, func(s *UserSubscription) { s.Status = "expired"; s.EndTime = now - 1 }) // lapsed

	for _, tc := range []struct {
		userId int
		want   bool
		why    string
	}{
		{7, true, "a renewing subscription must block a second checkout — both would bill"},
		{8, false, "cancelled means it will never bill again, so resubscribing is safe and must stay open"},
		{9, false, "a lapsed subscription must not block a new purchase"},
		{99, false, "a user with no subscription must be able to buy"},
	} {
		got, err := HasRenewingUserSubscription(tc.userId)
		if err != nil {
			t.Fatal(err)
		}
		if got != tc.want {
			t.Errorf("user %d: got %v want %v — %s", tc.userId, got, tc.want, tc.why)
		}
	}
}
