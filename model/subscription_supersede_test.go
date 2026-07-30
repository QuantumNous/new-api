package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestExpireSupersededUserSubscriptions(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	old := &UserSubscription{UserId: 7, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus"}
	if err := DB.Create(old).Error; err != nil {
		t.Fatal(err)
	}
	fresh := &UserSubscription{UserId: 7, PlanId: 2, Status: "active",
		StartTime: now, EndTime: now + 31536000, UpgradeGroup: "plus"}
	if err := DB.Create(fresh).Error; err != nil {
		t.Fatal(err)
	}
	other := &UserSubscription{UserId: 8, PlanId: 1, Status: "active",
		StartTime: now - 100, EndTime: now + 86400, UpgradeGroup: "plus"}
	if err := DB.Create(other).Error; err != nil {
		t.Fatal(err)
	}

	n, err := ExpireSupersededUserSubscriptions(7, 1, fresh.Id)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("want 1 row expired, got %d", n)
	}

	var reloaded UserSubscription
	DB.First(&reloaded, old.Id)
	if reloaded.Status != "expired" {
		t.Fatalf("old row must be expired, got %s", reloaded.Status)
	}
	var keep UserSubscription
	DB.First(&keep, fresh.Id)
	if keep.Status != "active" {
		t.Fatalf("annual row must stay active, got %s", keep.Status)
	}
	var untouched UserSubscription
	DB.First(&untouched, other.Id)
	if untouched.Status != "active" {
		t.Fatalf("another user's row must be untouched, got %s", untouched.Status)
	}
}
