package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newAffiliateStoreTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(model.AffiliateSidecarModels()...); err != nil {
		t.Fatalf("migrate affiliate sidecar models: %v", err)
	}
	return db
}

func TestCreateAffiliateProfile(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	profile, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:       101,
		Level:        1,
		ParentUserId: 0,
		InviteCode:   "aff101",
		ActorUserId:  1,
		Reason:       "test create",
	})
	if err != nil {
		t.Fatalf("CreateAffiliateProfile returned error: %v", err)
	}

	if profile.UserId != 101 || profile.Level != 1 || profile.Status != model.AffiliateProfileStatusActive {
		t.Fatalf("unexpected profile: %+v", profile)
	}
	if profile.ActivatedAt == 0 {
		t.Fatal("profile should record activated_at")
	}

	var auditCount int64
	if err := db.Model(&model.AffiliateAuditLog{}).Where("target_user_id = ? AND action = ?", 101, AffiliateAuditActionCreateProfile).Count(&auditCount).Error; err != nil {
		t.Fatalf("count audit logs: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected 1 audit log, got %d", auditCount)
	}
}

func TestSetAffiliateProfileUpdatesExistingProfile(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      201,
		Level:       1,
		InviteCode:  "first",
		ActorUserId: 1,
		Reason:      "initial",
	}); err != nil {
		t.Fatalf("CreateAffiliateProfile returned error: %v", err)
	}

	profile, err := SetAffiliateProfile(db, AffiliateProfileSetInput{
		UserId:       201,
		Level:        2,
		ParentUserId: 100,
		InviteCode:   "second",
		ActorUserId:  1,
		Reason:       "promote",
	})
	if err != nil {
		t.Fatalf("SetAffiliateProfile returned error: %v", err)
	}
	if profile.Level != 2 || profile.ParentUserId != 100 || profile.InviteCode != "second" || profile.Status != model.AffiliateProfileStatusActive {
		t.Fatalf("unexpected updated profile: %+v", profile)
	}

	var count int64
	if err := db.Model(&model.AffiliateProfile{}).Where("user_id = ?", 201).Count(&count).Error; err != nil {
		t.Fatalf("count profiles: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one profile row, got %d", count)
	}
}

func TestDisableAffiliateProfileDisablesRelationsAndAudits(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      301,
		Level:       1,
		InviteCode:  "aff301",
		ActorUserId: 1,
		Reason:      "initial",
	}); err != nil {
		t.Fatalf("CreateAffiliateProfile returned error: %v", err)
	}
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   301,
		DescendantUserId: 302,
		Depth:            1,
		Status:           model.AffiliateProfileStatusActive,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed relation: %v", err)
	}

	if err := DisableAffiliateProfile(db, AffiliateProfileStatusInput{
		UserId:      301,
		ActorUserId: 1,
		Reason:      "risk",
	}); err != nil {
		t.Fatalf("DisableAffiliateProfile returned error: %v", err)
	}

	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 301).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Status != model.AffiliateProfileStatusDisabled || profile.DisabledAt == 0 {
		t.Fatalf("expected disabled profile with disabled_at, got %+v", profile)
	}

	var relation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ?", 301, 302).First(&relation).Error; err != nil {
		t.Fatalf("query relation: %v", err)
	}
	if relation.Status != model.AffiliateProfileStatusDisabled || relation.EndedAt == 0 {
		t.Fatalf("expected disabled relation with ended_at, got %+v", relation)
	}

	var auditCount int64
	if err := db.Model(&model.AffiliateAuditLog{}).Where("target_user_id = ? AND action = ?", 301, AffiliateAuditActionDisableProfile).Count(&auditCount).Error; err != nil {
		t.Fatalf("count audit logs: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected 1 disable audit log, got %d", auditCount)
	}
}

func TestEnableAffiliateProfileReactivatesProfileAndAudits(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	profile, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      401,
		Level:       1,
		InviteCode:  "aff401",
		ActorUserId: 1,
		Reason:      "initial",
	})
	if err != nil {
		t.Fatalf("CreateAffiliateProfile returned error: %v", err)
	}
	if err := DisableAffiliateProfile(db, AffiliateProfileStatusInput{
		UserId:      profile.UserId,
		ActorUserId: 1,
		Reason:      "risk",
	}); err != nil {
		t.Fatalf("DisableAffiliateProfile returned error: %v", err)
	}

	enabled, err := EnableAffiliateProfile(db, AffiliateProfileStatusInput{
		UserId:      profile.UserId,
		ActorUserId: 1,
		Reason:      "restore",
	})
	if err != nil {
		t.Fatalf("EnableAffiliateProfile returned error: %v", err)
	}
	if enabled.Status != model.AffiliateProfileStatusActive || enabled.DisabledAt != 0 || enabled.ActivatedAt == 0 {
		t.Fatalf("expected active profile, got %+v", enabled)
	}

	var auditCount int64
	if err := db.Model(&model.AffiliateAuditLog{}).Where("target_user_id = ? AND action = ?", 401, AffiliateAuditActionEnableProfile).Count(&auditCount).Error; err != nil {
		t.Fatalf("count audit logs: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected 1 enable audit log, got %d", auditCount)
	}
}

func TestBuildAffiliateInviteRelationsCreatesTwoLevelClosure(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   1,
		DescendantUserId: 2,
		Depth:            1,
		DirectInviterId:  1,
		Status:           model.AffiliateProfileStatusActive,
		Source:           AffiliateInviteSourceAffiliate,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed relation: %v", err)
	}

	if err := BuildAffiliateInviteRelations(db, AffiliateRelationCreateInput{
		InviterUserId: 2,
		InviteeUserId: 3,
		InviteEventId: 77,
		Source:        AffiliateInviteSourceAffiliate,
		EffectiveAt:   200,
	}); err != nil {
		t.Fatalf("BuildAffiliateInviteRelations returned error: %v", err)
	}

	var relations []model.AffiliateRelation
	if err := db.Order("ancestor_user_id asc, descendant_user_id asc, depth asc").Find(&relations).Error; err != nil {
		t.Fatalf("query relations: %v", err)
	}

	if len(relations) != 3 {
		t.Fatalf("expected 3 relations including seed, got %d: %+v", len(relations), relations)
	}
	assertRelationExists(t, relations, 1, 2, 1)
	assertRelationExists(t, relations, 1, 3, 2)
	assertRelationExists(t, relations, 2, 3, 1)
}

func TestRecordAffiliateAuditLog(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	if err := RecordAffiliateAuditLog(db, AffiliateAuditInput{
		ActorUserId:  9,
		TargetUserId: 10,
		TargetType:   "profile",
		TargetId:     11,
		Action:       "disable_profile",
		Reason:       "policy",
		RequestId:    "req-test",
	}); err != nil {
		t.Fatalf("RecordAffiliateAuditLog returned error: %v", err)
	}

	var audit model.AffiliateAuditLog
	if err := db.First(&audit).Error; err != nil {
		t.Fatalf("query audit: %v", err)
	}
	if audit.ActorUserId != 9 || audit.TargetUserId != 10 || audit.Action != "disable_profile" || audit.RequestId != "req-test" {
		t.Fatalf("unexpected audit log: %+v", audit)
	}
}

func assertRelationExists(t *testing.T, relations []model.AffiliateRelation, ancestor int, descendant int, depth int) {
	t.Helper()
	for _, relation := range relations {
		if relation.AncestorUserId == ancestor && relation.DescendantUserId == descendant && relation.Depth == depth {
			return
		}
	}
	t.Fatalf("missing relation ancestor=%d descendant=%d depth=%d in %+v", ancestor, descendant, depth, relations)
}
