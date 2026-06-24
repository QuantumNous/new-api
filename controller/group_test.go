package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestUserCanUseGroupsReadsAuthoritativeGroup(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	user := seedTokenUser(t, db, 21)
	user.Group = "Enterprise"
	user.IsEnterprise = false
	if err := db.Save(user).Error; err != nil {
		t.Fatalf("failed to update user: %v", err)
	}

	canUseGroups, err := userCanUseGroups(21)
	if err != nil {
		t.Fatalf("expected group lookup to succeed: %v", err)
	}
	if !canUseGroups {
		t.Fatalf("expected non-plg DB group to enable group selection")
	}

	if err := db.Model(&model.User{}).Where("id = ?", 21).Update("group", plgGroup).Error; err != nil {
		t.Fatalf("failed to update user group: %v", err)
	}
	canUseGroups, err = userCanUseGroups(21)
	if err != nil {
		t.Fatalf("expected group lookup to succeed after plg update: %v", err)
	}
	if canUseGroups {
		t.Fatalf("expected plg DB group to disable group selection")
	}

	if err := db.Model(&model.User{}).Where("id = ?", 21).Update("group", "").Error; err != nil {
		t.Fatalf("failed to clear user group: %v", err)
	}
	canUseGroups, err = userCanUseGroups(21)
	if err != nil {
		t.Fatalf("expected group lookup to succeed after empty group update: %v", err)
	}
	if canUseGroups {
		t.Fatalf("expected empty DB group to disable group selection")
	}
}
