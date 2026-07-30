package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestExpireSupersededUserSubscriptions(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	// Row to be expired
	old := &UserSubscription{UserId: 7, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus"}
	if err := DB.Create(old).Error; err != nil {
		t.Fatal(err)
	}

	// Row on different plan (annual replacement) — should not be touched
	fresh := &UserSubscription{UserId: 7, PlanId: 2, Status: "active",
		StartTime: now, EndTime: now + 31536000, UpgradeGroup: "plus"}
	if err := DB.Create(fresh).Error; err != nil {
		t.Fatal(err)
	}

	// Row for different user on same plan — should not be touched
	other := &UserSubscription{UserId: 8, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus"}
	if err := DB.Create(other).Error; err != nil {
		t.Fatal(err)
	}

	// Row on same plan (PlanId 1) for same user but kept by id exclusion
	// This exercises the id <> keepSubId filter
	sameplankeep := &UserSubscription{UserId: 7, PlanId: 1, Status: "active",
		StartTime: now - 50, EndTime: now + 90000, UpgradeGroup: "plus"}
	if err := DB.Create(sameplankeep).Error; err != nil {
		t.Fatal(err)
	}

	// Row on different plan (PlanId 3) for same user — should not be touched
	// This exercises the plan_id filter
	differentplan := &UserSubscription{UserId: 7, PlanId: 3, Status: "active",
		StartTime: now, EndTime: now + 31536000, UpgradeGroup: "plus"}
	if err := DB.Create(differentplan).Error; err != nil {
		t.Fatal(err)
	}

	// Expire user 7's PlanId 1 rows, but keep sameplankeep by id
	n, err := ExpireSupersededUserSubscriptions(7, 1, sameplankeep.Id)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("want 1 row expired, got %d", n)
	}

	// Verify old row is expired
	var reloaded UserSubscription
	DB.First(&reloaded, old.Id)
	if reloaded.Status != "expired" {
		t.Fatalf("old row must be expired, got %s", reloaded.Status)
	}

	// Verify fresh row (different plan) stays active
	var keep UserSubscription
	DB.First(&keep, fresh.Id)
	if keep.Status != "active" {
		t.Fatalf("different plan row must stay active, got %s", keep.Status)
	}

	// Verify other user's row stays active
	var untouched UserSubscription
	DB.First(&untouched, other.Id)
	if untouched.Status != "active" {
		t.Fatalf("another user's row must be untouched, got %s", untouched.Status)
	}

	// Verify same-plan row kept by id exclusion stays active (tests id <> keepSubId)
	var keptByIdExclusion UserSubscription
	DB.First(&keptByIdExclusion, sameplankeep.Id)
	if keptByIdExclusion.Status != "active" {
		t.Fatalf("same-plan row kept by id must stay active, got %s", keptByIdExclusion.Status)
	}

	// Verify different plan row stays active (tests plan_id filter)
	var differentPlanRow UserSubscription
	DB.First(&differentPlanRow, differentplan.Id)
	if differentPlanRow.Status != "active" {
		t.Fatalf("different plan row must stay active, got %s", differentPlanRow.Status)
	}
}
