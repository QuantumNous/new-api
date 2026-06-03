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
	if err := db.AutoMigrate(append(model.AffiliateSidecarModels(), &model.User{})...); err != nil {
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
		UserId:      100,
		Level:       1,
		InviteCode:  "parent",
		ActorUserId: 1,
		Reason:      "parent",
	}); err != nil {
		t.Fatalf("CreateAffiliateProfile parent returned error: %v", err)
	}
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

func TestSetAffiliateProfileRequiresActiveLevelOneParentForLevelTwo(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	if _, err := SetAffiliateProfile(db, AffiliateProfileSetInput{
		UserId:      211,
		Level:       2,
		ActorUserId: 1,
		Reason:      "missing parent",
	}); err == nil {
		t.Fatal("expected missing level two parent to be rejected")
	}

	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      210,
		Level:       1,
		ActorUserId: 1,
		Reason:      "seed parent",
	}); err != nil {
		t.Fatalf("seed parent profile: %v", err)
	}
	if err := DisableAffiliateProfile(db, AffiliateProfileStatusInput{
		UserId:      210,
		ActorUserId: 1,
		Reason:      "disable parent",
	}); err != nil {
		t.Fatalf("disable parent profile: %v", err)
	}
	if _, err := SetAffiliateProfile(db, AffiliateProfileSetInput{
		UserId:       211,
		Level:        2,
		ParentUserId: 210,
		ActorUserId:  1,
		Reason:       "disabled parent",
	}); err == nil {
		t.Fatal("expected disabled level one parent to be rejected")
	}
}

func TestSetAffiliateProfileAcceptsLevelTwoWithActiveLevelOneParent(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      220,
		Level:       1,
		ActorUserId: 1,
		Reason:      "seed parent",
	}); err != nil {
		t.Fatalf("seed parent profile: %v", err)
	}

	profile, err := SetAffiliateProfile(db, AffiliateProfileSetInput{
		UserId:       221,
		Level:        2,
		ParentUserId: 220,
		ActorUserId:  1,
		Reason:       "create level two",
	})
	if err != nil {
		t.Fatalf("SetAffiliateProfile returned error: %v", err)
	}
	if profile.Level != 2 || profile.ParentUserId != 220 || profile.Status != model.AffiliateProfileStatusActive {
		t.Fatalf("unexpected level two profile: %+v", profile)
	}
}

func TestListAffiliateProfilesFiltersAndPaginates(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      310,
		Level:       1,
		InviteCode:  "aff310",
		ActorUserId: 1,
		Reason:      "seed level one",
	}); err != nil {
		t.Fatalf("seed level one profile: %v", err)
	}
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:       311,
		Level:        2,
		ParentUserId: 310,
		InviteCode:   "aff311",
		ActorUserId:  1,
		Reason:       "seed level two",
	}); err != nil {
		t.Fatalf("seed level two profile: %v", err)
	}
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      312,
		Level:       1,
		InviteCode:  "aff312",
		ActorUserId: 1,
		Reason:      "seed disabled",
	}); err != nil {
		t.Fatalf("seed disabled profile: %v", err)
	}
	if err := DisableAffiliateProfile(db, AffiliateProfileStatusInput{
		UserId:      312,
		ActorUserId: 1,
		Reason:      "disable seed",
	}); err != nil {
		t.Fatalf("disable profile: %v", err)
	}

	profiles, total, err := ListAffiliateProfiles(db, AffiliateProfileListInput{
		Level:    1,
		Status:   model.AffiliateProfileStatusActive,
		StartIdx: 0,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("ListAffiliateProfiles returned error: %v", err)
	}
	if total != 1 || len(profiles) != 1 || profiles[0].UserId != 310 {
		t.Fatalf("unexpected active level one result total=%d profiles=%+v", total, profiles)
	}

	profiles, total, err = ListAffiliateProfiles(db, AffiliateProfileListInput{
		UserId:   312,
		StartIdx: 0,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("ListAffiliateProfiles by user returned error: %v", err)
	}
	if total != 1 || len(profiles) != 1 || profiles[0].Status != model.AffiliateProfileStatusDisabled {
		t.Fatalf("unexpected user filter result total=%d profiles=%+v", total, profiles)
	}
}

func TestListAffiliateProfilesFallsBackToUserAffCode(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if err := db.Create(&model.User{Id: 320, Username: "affiliate320", AffCode: "AFF320"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      320,
		Level:       1,
		ActorUserId: 1,
		Reason:      "seed empty invite code",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	profiles, total, err := ListAffiliateProfiles(db, AffiliateProfileListInput{
		UserId:   320,
		StartIdx: 0,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("ListAffiliateProfiles returned error: %v", err)
	}
	if total != 1 || len(profiles) != 1 {
		t.Fatalf("unexpected profile result total=%d profiles=%+v", total, profiles)
	}
	if profiles[0].InviteCode != "AFF320" {
		t.Fatalf("expected invite code fallback to user aff_code, got %+v", profiles[0])
	}
	if profiles[0].Username != "affiliate320" {
		t.Fatalf("expected profile username to be filled from user table, got %+v", profiles[0])
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

func TestResolveInviteContextUsesActiveAffiliateProfile(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("migrate users: %v", err)
	}
	if err := db.Create(&model.User{Id: 501, Username: "aff501", AffCode: "AFF501"}).Error; err != nil {
		t.Fatalf("seed inviter: %v", err)
	}
	if _, err := CreateAffiliateProfile(db, AffiliateProfileCreateInput{
		UserId:      501,
		Level:       1,
		InviteCode:  "AFF501",
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	ctx, err := ResolveInviteContext(db, AffiliateInviteContextInput{
		ModuleEnabled:  true,
		InviteCode:     " AFF501 ",
		RegisterMethod: AffiliateRegisterMethodPassword,
		Provider:       "",
	})
	if err != nil {
		t.Fatalf("ResolveInviteContext returned error: %v", err)
	}

	if ctx.Source != AffiliateInviteSourceAffiliate || ctx.InviterUserId != 501 || ctx.InviteCode != "AFF501" {
		t.Fatalf("unexpected invite context: %+v", ctx)
	}
	if ctx.RegisterMethod != AffiliateRegisterMethodPassword {
		t.Fatalf("unexpected register method: %+v", ctx)
	}
}

func TestRecordAffiliateInviteEventStoresRegistrationMetadata(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	event, err := RecordAffiliateInviteEvent(db, AffiliateInviteEventInput{
		InviteeUserId:      601,
		InviterUserId:      501,
		InviteCode:         "AFF501",
		InviteSource:       AffiliateInviteSourceAffiliate,
		RegisterMethod:     AffiliateRegisterMethodOAuth,
		Provider:           "github",
		InitialQuota:       1000,
		InitialAmountCents: 99,
		InitialQuotaRule:   "affiliate_initial",
		Metadata:           `{"synthetic_affiliate_test":true}`,
	})
	if err != nil {
		t.Fatalf("RecordAffiliateInviteEvent returned error: %v", err)
	}

	var saved model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", 601).First(&saved).Error; err != nil {
		t.Fatalf("query invite event: %v", err)
	}
	if event.Id == 0 || saved.Id != event.Id {
		t.Fatalf("expected persisted event id, got event=%+v saved=%+v", event, saved)
	}
	if saved.InviteSource != AffiliateInviteSourceAffiliate || saved.RegisterMethod != AffiliateRegisterMethodOAuth || saved.Provider != "github" {
		t.Fatalf("unexpected invite event attribution: %+v", saved)
	}
	if saved.InitialQuota != 1000 || saved.InitialAmountCents != 99 || saved.InitialQuotaRule != "affiliate_initial" {
		t.Fatalf("unexpected initial quota fields: %+v", saved)
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

func TestListAffiliateVisibleUserIdsRespectsScopeDepth(t *testing.T) {
	db := newAffiliateStoreTestDB(t)
	relations := []model.AffiliateRelation{
		{AncestorUserId: 100, DescendantUserId: 200, Depth: 1, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 300, Depth: 2, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 400, Depth: 3, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 100, DescendantUserId: 500, Depth: 1, Status: model.AffiliateProfileStatusDisabled},
		{AncestorUserId: 200, DescendantUserId: 300, Depth: 1, Status: model.AffiliateProfileStatusActive},
		{AncestorUserId: 200, DescendantUserId: 600, Depth: 2, Status: model.AffiliateProfileStatusActive},
	}
	if err := db.Create(&relations).Error; err != nil {
		t.Fatalf("seed relations: %v", err)
	}

	levelOne, err := ListAffiliateVisibleUserIds(db, AffiliateScope{
		Kind:           AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})
	if err != nil {
		t.Fatalf("ListAffiliateVisibleUserIds level one returned error: %v", err)
	}
	if levelOne.Global {
		t.Fatalf("level one scope should not be global: %+v", levelOne)
	}
	assertIntSliceEqual(t, levelOne.UserIds, []int{200, 300})

	levelTwo, err := ListAffiliateVisibleUserIds(db, AffiliateScope{
		Kind:           AffiliateScopeAffiliate,
		UserId:         200,
		AffiliateLevel: 2,
		MaxDepth:       1,
	})
	if err != nil {
		t.Fatalf("ListAffiliateVisibleUserIds level two returned error: %v", err)
	}
	assertIntSliceEqual(t, levelTwo.UserIds, []int{300})
}

func TestListAffiliateVisibleUserIdsRejectsNoneAndKeepsGlobalUnfiltered(t *testing.T) {
	db := newAffiliateStoreTestDB(t)

	none, err := ListAffiliateVisibleUserIds(db, AffiliateScope{Kind: AffiliateScopeNone, UserId: 9})
	if err == nil {
		t.Fatalf("expected none scope to be rejected, got %+v", none)
	}

	global, err := ListAffiliateVisibleUserIds(db, AffiliateScope{Kind: AffiliateScopeGlobal, UserId: 1})
	if err != nil {
		t.Fatalf("ListAffiliateVisibleUserIds global returned error: %v", err)
	}
	if !global.Global || len(global.UserIds) != 0 {
		t.Fatalf("expected unfiltered global scope, got %+v", global)
	}
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

func assertIntSliceEqual(t *testing.T, got []int, want []int) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}
