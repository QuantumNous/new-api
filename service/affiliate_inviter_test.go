package service

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestSearchAffiliateInviterCandidatesFindsByIdAndUsername(t *testing.T) {
	db := newAffiliateInviterTestDB(t)
	seedAffiliateInviterUser(t, db, model.User{Id: 100, Username: "alpha"})
	seedAffiliateInviterUser(t, db, model.User{Id: 200, Username: "bravo"})

	byName, total, err := SearchAffiliateInviterCandidates(db, AffiliateInviterCandidateSearchInput{
		Keyword:  "bra",
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("SearchAffiliateInviterCandidates by name returned error: %v", err)
	}
	if total != 1 || len(byName) != 1 || byName[0].Id != 200 {
		t.Fatalf("unexpected name search result total=%d users=%+v", total, byName)
	}

	byId, total, err := SearchAffiliateInviterCandidates(db, AffiliateInviterCandidateSearchInput{
		Keyword:  "100",
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("SearchAffiliateInviterCandidates by id returned error: %v", err)
	}
	if total != 1 || len(byId) != 1 || byId[0].Id != 100 {
		t.Fatalf("unexpected id search result total=%d users=%+v", total, byId)
	}
}

func TestPreviewAffiliateInviterChangeShowsCurrentAndNewPath(t *testing.T) {
	db := newAffiliateInviterTestDB(t)
	seedAffiliateInviterUser(t, db, model.User{Id: 100, Username: "root"})
	seedAffiliateInviterUser(t, db, model.User{Id: 200, Username: "current"})
	seedAffiliateInviterUser(t, db, model.User{Id: 300, Username: "target", InviterId: 200})
	seedAffiliateInviterRelation(t, db, 100, 200, 1)
	seedAffiliateInviterRelation(t, db, 200, 300, 1)

	preview, err := PreviewAffiliateInviterChange(db, AffiliateInviterChangeInput{
		TargetUserId:     300,
		NewInviterUserId: 100,
	})
	if err != nil {
		t.Fatalf("PreviewAffiliateInviterChange returned error: %v", err)
	}
	if preview.TargetUserId != 300 || preview.CurrentInviterUserId != 200 || preview.NewInviterUserId != 100 {
		t.Fatalf("unexpected preview identity: %+v", preview)
	}
	assertIntSliceEqual(t, preview.CurrentPathUserIds, []int{200})
	assertIntSliceEqual(t, preview.NewPathUserIds, []int{100})
	assertIntSliceEqual(t, preview.AffectedDescendantUserIds, []int{300})
}

func TestUpdateAffiliateInviterUpdatesUserAttributionRelationsAndAudit(t *testing.T) {
	db := newAffiliateInviterTestDB(t)
	seedAffiliateInviterUser(t, db, model.User{Id: 100, Username: "new-affiliate", AffCode: "AFF100"})
	seedAffiliateInviterUser(t, db, model.User{Id: 200, Username: "old-affiliate", AffCode: "AFF200"})
	seedAffiliateInviterUser(t, db, model.User{Id: 300, Username: "target", InviterId: 200})
	seedAffiliateInviterProfile(t, db, 100, 1)
	seedAffiliateInviterProfile(t, db, 200, 1)
	seedAffiliateInviterRelation(t, db, 200, 300, 1)

	preview, err := UpdateAffiliateInviter(db, AffiliateInviterChangeInput{
		TargetUserId:     300,
		NewInviterUserId: 100,
		ActorUserId:      9,
		Reason:           "manual correction",
	})
	if err != nil {
		t.Fatalf("UpdateAffiliateInviter returned error: %v", err)
	}
	if preview.CurrentInviterUserId != 200 || preview.NewInviterUserId != 100 {
		t.Fatalf("unexpected returned preview: %+v", preview)
	}

	var user model.User
	if err := db.First(&user, 300).Error; err != nil {
		t.Fatalf("load target user: %v", err)
	}
	if user.InviterId != 100 {
		t.Fatalf("expected inviter_id updated to 100, got %+v", user)
	}

	var oldRelation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", 200, 300, 1).First(&oldRelation).Error; err != nil {
		t.Fatalf("load old relation: %v", err)
	}
	if oldRelation.Status != model.AffiliateProfileStatusDisabled || oldRelation.EndedAt == 0 {
		t.Fatalf("expected old relation disabled, got %+v", oldRelation)
	}

	var newRelation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", 100, 300, 1).First(&newRelation).Error; err != nil {
		t.Fatalf("load new relation: %v", err)
	}
	if newRelation.Status != model.AffiliateProfileStatusActive || newRelation.DirectInviterId != 100 || newRelation.EndedAt != 0 {
		t.Fatalf("expected active new relation, got %+v", newRelation)
	}

	var inviteEvent model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", 300).First(&inviteEvent).Error; err != nil {
		t.Fatalf("load invite event: %v", err)
	}
	if inviteEvent.InviterUserId != 100 || inviteEvent.InviteSource != AffiliateInviteSourceAffiliate || inviteEvent.InviteCode != "AFF100" {
		t.Fatalf("unexpected invite event: %+v", inviteEvent)
	}

	var audit model.AffiliateAuditLog
	if err := db.Where("target_user_id = ? AND action = ?", 300, AffiliateAuditActionUpdateInviter).First(&audit).Error; err != nil {
		t.Fatalf("load audit: %v", err)
	}
	if audit.ActorUserId != 9 || audit.Reason != "manual correction" || audit.BeforeSnapshot == "" || audit.AfterSnapshot == "" {
		t.Fatalf("unexpected audit log: %+v", audit)
	}
}

func TestUpdateAffiliateInviterRejectsSelfAndCycle(t *testing.T) {
	db := newAffiliateInviterTestDB(t)
	seedAffiliateInviterUser(t, db, model.User{Id: 100, Username: "root"})
	seedAffiliateInviterUser(t, db, model.User{Id: 200, Username: "child", InviterId: 100})
	seedAffiliateInviterRelation(t, db, 100, 200, 1)

	if _, err := UpdateAffiliateInviter(db, AffiliateInviterChangeInput{
		TargetUserId:     100,
		NewInviterUserId: 100,
		ActorUserId:      9,
	}); err == nil {
		t.Fatal("expected self inviter to be rejected")
	}

	if _, err := UpdateAffiliateInviter(db, AffiliateInviterChangeInput{
		TargetUserId:     100,
		NewInviterUserId: 200,
		ActorUserId:      9,
	}); err == nil {
		t.Fatal("expected descendant inviter cycle to be rejected")
	}
}

func newAffiliateInviterTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(append(model.AffiliateSidecarModels(), &model.User{})...); err != nil {
		t.Fatalf("migrate affiliate inviter models: %v", err)
	}
	return db
}

func seedAffiliateInviterUser(t *testing.T, db *gorm.DB, user model.User) {
	t.Helper()
	if user.Password == "" {
		user.Password = "hashed"
	}
	if user.AffCode == "" {
		user.AffCode = "AFF" + strconv.Itoa(user.Id)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
}

func seedAffiliateInviterProfile(t *testing.T, db *gorm.DB, userId int, level int) {
	t.Helper()
	if err := db.Create(&model.AffiliateProfile{
		UserId: userId,
		Level:  level,
		Status: model.AffiliateProfileStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}
}

func seedAffiliateInviterRelation(t *testing.T, db *gorm.DB, ancestor int, descendant int, depth int) {
	t.Helper()
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   ancestor,
		DescendantUserId: descendant,
		Depth:            depth,
		DirectInviterId:  ancestor,
		Status:           model.AffiliateProfileStatusActive,
		Source:           AffiliateInviteSourceAffiliate,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed relation: %v", err)
	}
}
