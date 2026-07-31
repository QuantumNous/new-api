package model

import (
	"errors"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestBytePlusAssetModelsAutoMigrateAndUniqueness(t *testing.T) {
	db := newBytePlusAssetTestDB(t)

	if db.Migrator().HasColumn(&BytePlusAsset{}, "source_url") {
		t.Fatal("source_url must not be migrated because upload URLs can contain signed secrets")
	}
	if !db.Migrator().HasColumn(&BytePlusAsset{}, "real_person_profile_id") {
		t.Fatal("real_person_profile_id must be migrated for real-person asset ownership")
	}

	if err := db.Create(&BytePlusAssetGroup{UserId: 1, ChannelId: 101, Status: BytePlusAssetGroupStatusCreating}).Error; err != nil {
		t.Fatalf("create group: %v", err)
	}
	if err := db.Create(&BytePlusAssetGroup{UserId: 1, ChannelId: 101, Status: BytePlusAssetGroupStatusCreating}).Error; err == nil {
		t.Fatal("duplicate user/channel group should fail")
	}
	if err := db.Create(&BytePlusAsset{
		PublicId:           "ast_unique",
		UserId:             1,
		AssetGroupId:       1,
		ChannelId:          101,
		AssetType:          "Image",
		SourceURL:          "https://example.com/a.png",
		ModerationStrategy: "Default",
		Status:             BytePlusAssetStatusCreating,
	}).Error; err != nil {
		t.Fatalf("create asset: %v", err)
	}
	if err := db.Create(&BytePlusAsset{
		PublicId:           "ast_unique",
		UserId:             2,
		AssetGroupId:       1,
		ChannelId:          101,
		AssetType:          "Image",
		SourceURL:          "https://example.com/b.png",
		ModerationStrategy: "Default",
		Status:             BytePlusAssetStatusCreating,
	}).Error; err == nil {
		t.Fatal("duplicate public asset id should fail")
	}
}

func TestBytePlusAssetGroupClaimLifecycle(t *testing.T) {
	newBytePlusAssetTestDB(t)

	group, owner, err := ClaimBytePlusAssetGroup(10, 131, 1000, 900)
	if err != nil {
		t.Fatalf("initial claim error: %v", err)
	}
	if !owner || group.UserId != 10 || group.ChannelId != 131 || group.Status != BytePlusAssetGroupStatusCreating || group.LeaseUpdatedTime != 1000 {
		t.Fatalf("initial claim = %+v owner=%v", group, owner)
	}

	group, owner, err = ClaimBytePlusAssetGroup(10, 131, 1010, 900)
	if err != nil {
		t.Fatalf("fresh claim error: %v", err)
	}
	if owner || group.LeaseUpdatedTime != 1000 {
		t.Fatalf("fresh lease should not transfer ownership: %+v owner=%v", group, owner)
	}

	group, owner, err = ClaimBytePlusAssetGroup(10, 131, 1200, 1100)
	if err != nil {
		t.Fatalf("stale takeover error: %v", err)
	}
	if !owner || group.LeaseUpdatedTime != 1200 {
		t.Fatalf("stale lease should transfer ownership: %+v owner=%v", group, owner)
	}

	updated, err := FailBytePlusAssetGroup(group.Id, group.LeaseUpdatedTime, "req-failed", "sanitized", 1210)
	if err != nil {
		t.Fatalf("fail group: %v", err)
	}
	if !updated {
		t.Fatal("lease owner should be able to fail the group")
	}
	group, owner, err = ClaimBytePlusAssetGroup(10, 131, 1220, 1100)
	if err != nil {
		t.Fatalf("failed retry error: %v", err)
	}
	if !owner || group.Status != BytePlusAssetGroupStatusCreating || group.ErrorMessage != "" || group.LeaseUpdatedTime != 1220 {
		t.Fatalf("failed retry should reclaim as creating: %+v owner=%v", group, owner)
	}

	updated, err = ActivateBytePlusAssetGroup(group.Id, group.LeaseUpdatedTime, "upstream-group", "req-active", 1230)
	if err != nil {
		t.Fatalf("activate group: %v", err)
	}
	if !updated {
		t.Fatal("lease owner should be able to activate the group")
	}
	group, owner, err = ClaimBytePlusAssetGroup(10, 131, 1240, 1100)
	if err != nil {
		t.Fatalf("active reuse error: %v", err)
	}
	if owner || group.Status != BytePlusAssetGroupStatusActive || group.UpstreamGroupId != "upstream-group" {
		t.Fatalf("active group should be reused without ownership: %+v owner=%v", group, owner)
	}
}

func TestBytePlusAssetGroupRejectsLatePreviousOwner(t *testing.T) {
	newBytePlusAssetTestDB(t)

	first, owner, err := ClaimBytePlusAssetGroup(11, 131, 1000, 900)
	if err != nil || !owner {
		t.Fatalf("initial claim = %+v owner=%v err=%v", first, owner, err)
	}
	second, owner, err := ClaimBytePlusAssetGroup(11, 131, 1200, 1100)
	if err != nil || !owner {
		t.Fatalf("takeover claim = %+v owner=%v err=%v", second, owner, err)
	}

	updated, err := ActivateBytePlusAssetGroup(first.Id, first.LeaseUpdatedTime, "group-from-old-owner", "req-old", 1210)
	if err != nil {
		t.Fatalf("late activation error: %v", err)
	}
	if updated {
		t.Fatal("previous lease owner must not activate after takeover")
	}
	updated, err = ActivateBytePlusAssetGroup(second.Id, second.LeaseUpdatedTime, "group-current", "req-current", 1220)
	if err != nil || !updated {
		t.Fatalf("current activation updated=%v err=%v", updated, err)
	}
	updated, err = FailBytePlusAssetGroup(first.Id, first.LeaseUpdatedTime, "req-late-fail", "late", 1230)
	if err != nil {
		t.Fatalf("late failure error: %v", err)
	}
	if updated {
		t.Fatal("previous lease owner must not fail an active group")
	}

	stored, _, err := ClaimBytePlusAssetGroup(11, 131, 1240, 1100)
	if err != nil {
		t.Fatalf("reload active group: %v", err)
	}
	if stored.Status != BytePlusAssetGroupStatusActive || stored.UpstreamGroupId != "group-current" || stored.UpstreamRequestId != "req-current" {
		t.Fatalf("late owner polluted group: %+v", stored)
	}
}

func TestBytePlusAssetOwnershipLookupAndStateUpdates(t *testing.T) {
	newBytePlusAssetTestDB(t)

	asset, err := CreateBytePlusAsset(BytePlusAsset{
		PublicId:           "ast_lookup",
		UserId:             20,
		AssetGroupId:       7,
		ChannelId:          131,
		AssetType:          "Video",
		SourceURL:          "https://example.com/a.mp4",
		ModerationStrategy: "Skip",
		Status:             BytePlusAssetStatusCreating,
		CreatedTime:        2000,
		UpdatedTime:        2000,
	})
	if err != nil {
		t.Fatalf("create asset: %v", err)
	}
	if err := UpdateBytePlusAssetUpstreamCreated(asset.Id, "upstream-asset", "req-create", BytePlusAssetStatusProcessing, 2010); err != nil {
		t.Fatalf("upstream created update: %v", err)
	}
	if err := UpdateBytePlusAssetStatus(asset.Id, BytePlusAssetStatusActive, "", 2020); err != nil {
		t.Fatalf("status update: %v", err)
	}

	got, err := GetBytePlusAssetByPublicIDForUser(20, "ast_lookup")
	if err != nil {
		t.Fatalf("lookup owner: %v", err)
	}
	if got.UpstreamAssetId != "upstream-asset" || got.UpstreamRequestId != "req-create" || got.Status != BytePlusAssetStatusActive || got.UpdatedTime != 2020 {
		t.Fatalf("stored asset = %+v", got)
	}
	if _, err := GetBytePlusAssetByPublicIDForUser(21, "ast_lookup"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("wrong user lookup error = %v", err)
	}

	assets, err := GetBytePlusAssetsByPublicIDsForUser(20, []string{"ast_lookup", "ast_missing", "ast_lookup"})
	if err != nil {
		t.Fatalf("batch lookup: %v", err)
	}
	if len(assets) != 1 || assets[0].PublicId != "ast_lookup" {
		t.Fatalf("batch assets = %+v", assets)
	}
}

func TestBytePlusAssetStatusUpdateDoesNotRegressTerminalAsset(t *testing.T) {
	newBytePlusAssetTestDB(t)

	asset, err := CreateBytePlusAsset(BytePlusAsset{
		PublicId:           "ast_terminal",
		UserId:             20,
		AssetGroupId:       7,
		ChannelId:          131,
		UpstreamAssetId:    "upstream-asset",
		AssetType:          "Video",
		SourceURL:          "https://example.com/a.mp4",
		ModerationStrategy: "Skip",
		Status:             BytePlusAssetStatusActive,
		CreatedTime:        2000,
		UpdatedTime:        2020,
	})
	if err != nil {
		t.Fatalf("create asset: %v", err)
	}

	if err := UpdateBytePlusAssetStatus(asset.Id, BytePlusAssetStatusProcessing, "", 2030); !errors.Is(err, ErrBytePlusAssetNotUpdatable) {
		t.Fatalf("stale processing update error = %v, want ErrBytePlusAssetNotUpdatable", err)
	}

	got, err := GetBytePlusAssetByPublicIDForUser(20, "ast_terminal")
	if err != nil {
		t.Fatalf("lookup asset: %v", err)
	}
	if got.Status != BytePlusAssetStatusActive || got.UpdatedTime != 2020 {
		t.Fatalf("terminal asset regressed: %+v", got)
	}
}

func TestBytePlusAssetDeletingAndDeletedAreTerminalForStatusPolling(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	for _, status := range []string{BytePlusAssetStatusDeleting, BytePlusAssetStatusDeleted} {
		asset := BytePlusAsset{PublicId: "ast_" + status, UserId: 7, ChannelId: 101, AssetType: "Image", Status: status}
		if err := DB.Create(&asset).Error; err != nil {
			t.Fatalf("create asset: %v", err)
		}
		err := UpdateBytePlusAssetStatus(asset.Id, BytePlusAssetStatusActive, "", 200)
		if !errors.Is(err, ErrBytePlusAssetNotUpdatable) {
			t.Fatalf("deletion status update error = %v, want ErrBytePlusAssetNotUpdatable", err)
		}
	}
}

func TestBytePlusAssetStatusTerminalTransitionsScheduleTempCleanup(t *testing.T) {
	for _, status := range []string{BytePlusAssetStatusActive, BytePlusAssetStatusFailed} {
		t.Run(status, func(t *testing.T) {
			newBytePlusRealPersonTestDB(t)
			asset := BytePlusAsset{PublicId: "ast_cleanup_" + status, UserId: 7, ChannelId: 101, AssetType: "Image", Status: BytePlusAssetStatusProcessing, CreatedTime: 100, UpdatedTime: 100}
			if err := DB.Create(&asset).Error; err != nil {
				t.Fatalf("create asset: %v", err)
			}
			object := BytePlusAssetTempObject{AssetId: &asset.Id, UserId: 7, ChannelId: 101, Bucket: "bucket", ObjectKey: "key-" + status, CleanupStatus: BytePlusTempObjectCleanupPending, NextCleanupAt: 5000, CleanupLeaseUpdatedTime: 123, CreatedTime: 100, UpdatedTime: 100}
			if err := DB.Create(&object).Error; err != nil {
				t.Fatalf("create temp object: %v", err)
			}

			err := UpdateBytePlusAssetStatus(asset.Id, status, "", 200)
			if err != nil {
				t.Fatalf("update status: %v", err)
			}

			if err := DB.First(&object, object.Id).Error; err != nil {
				t.Fatalf("reload temp object: %v", err)
			}
			if object.NextCleanupAt != 200 || object.CleanupLeaseUpdatedTime != 0 || object.UpdatedTime != 200 {
				t.Fatalf("terminal status did not schedule temp cleanup: %+v", object)
			}
		})
	}
}

func TestBytePlusAssetUpstreamCreatedDoesNotRegressTerminalAsset(t *testing.T) {
	newBytePlusAssetTestDB(t)

	for _, status := range []string{BytePlusAssetStatusActive, BytePlusAssetStatusFailed} {
		t.Run(status, func(t *testing.T) {
			asset, err := CreateBytePlusAsset(BytePlusAsset{
				PublicId:           "ast_upstream_created_terminal_" + status,
				UserId:             20,
				AssetGroupId:       7,
				ChannelId:          131,
				UpstreamAssetId:    "upstream-existing",
				UpstreamRequestId:  "req-existing",
				AssetType:          "Video",
				SourceURL:          "https://example.com/a.mp4",
				ModerationStrategy: "Skip",
				Status:             status,
				ErrorMessage:       "terminal message",
				CreatedTime:        2000,
				UpdatedTime:        2020,
			})
			if err != nil {
				t.Fatalf("create asset: %v", err)
			}

			err = UpdateBytePlusAssetUpstreamCreated(asset.Id, "upstream-late", "req-late", BytePlusAssetStatusProcessing, 2030)
			if err == nil {
				t.Fatal("late upstream-created update on terminal asset should return an error")
			}

			got, err := GetBytePlusAssetByPublicIDForUser(20, asset.PublicId)
			if err != nil {
				t.Fatalf("lookup asset: %v", err)
			}
			if got.Status != status || got.UpstreamAssetId != "upstream-existing" || got.UpstreamRequestId != "req-existing" || got.UpdatedTime != 2020 || got.ErrorMessage != "terminal message" {
				t.Fatalf("terminal asset regressed: %+v", got)
			}
		})
	}
}

func TestListBytePlusAssetsForRealPersonUsesStableCursorAndHidesDeleted(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	profile := BytePlusRealPersonProfile{PublicId: "rph_owned", UserId: 7, ChannelId: 101, Status: BytePlusRealPersonProfileStatusActive, CreatedTime: 1000, UpdatedTime: 1000}
	otherProfile := BytePlusRealPersonProfile{PublicId: "rph_other", UserId: 7, ChannelId: 101, Status: BytePlusRealPersonProfileStatusActive, CreatedTime: 1000, UpdatedTime: 1000}
	if err := DB.Create(&profile).Error; err != nil {
		t.Fatalf("create profile: %v", err)
	}
	if err := DB.Create(&otherProfile).Error; err != nil {
		t.Fatalf("create other profile: %v", err)
	}
	insertModelRealPersonAsset(t, "ast_new", 7, profile.Id, BytePlusAssetStatusActive, 2000, "")
	insertModelRealPersonAsset(t, "ast_tie_low", 7, profile.Id, BytePlusAssetStatusCreating, 1900, "")
	insertModelRealPersonAsset(t, "ast_tie_high", 7, profile.Id, BytePlusAssetStatusProcessing, 1900, "")
	insertModelRealPersonAsset(t, "ast_deleted", 7, profile.Id, BytePlusAssetStatusDeleted, 2100, "")
	insertModelRealPersonAsset(t, "ast_other_profile", 7, otherProfile.Id, BytePlusAssetStatusActive, 2200, "")
	insertModelRealPersonAsset(t, "ast_other_user", 8, profile.Id, BytePlusAssetStatusActive, 2300, "")

	first, hasMore, err := ListBytePlusAssetsForRealPerson(7, profile.Id, 2, "")
	if err != nil {
		t.Fatalf("list first page: %v", err)
	}
	if !hasMore || assetPublicIDs(first) != "ast_new,ast_tie_high" {
		t.Fatalf("first page ids=%s hasMore=%v", assetPublicIDs(first), hasMore)
	}
	second, hasMore, err := ListBytePlusAssetsForRealPerson(7, profile.Id, 2, "ast_tie_high")
	if err != nil {
		t.Fatalf("list second page: %v", err)
	}
	if hasMore || assetPublicIDs(second) != "ast_tie_low" {
		t.Fatalf("second page ids=%s hasMore=%v", assetPublicIDs(second), hasMore)
	}
}

func TestListBytePlusAssetsForRealPersonRejectsOutOfScopeAndDeletedCursors(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	profile := BytePlusRealPersonProfile{PublicId: "rph_owned", UserId: 7, ChannelId: 101, Status: BytePlusRealPersonProfileStatusActive}
	otherProfile := BytePlusRealPersonProfile{PublicId: "rph_other", UserId: 7, ChannelId: 101, Status: BytePlusRealPersonProfileStatusActive}
	if err := DB.Create(&profile).Error; err != nil {
		t.Fatalf("create profile: %v", err)
	}
	if err := DB.Create(&otherProfile).Error; err != nil {
		t.Fatalf("create other profile: %v", err)
	}
	insertModelRealPersonAsset(t, "ast_owned", 7, profile.Id, BytePlusAssetStatusActive, 2000, "")
	insertModelRealPersonAsset(t, "ast_cross_user", 8, profile.Id, BytePlusAssetStatusActive, 1900, "")
	insertModelRealPersonAsset(t, "ast_cross_profile", 7, otherProfile.Id, BytePlusAssetStatusActive, 1800, "")
	insertModelRealPersonAsset(t, "ast_deleted_cursor", 7, profile.Id, BytePlusAssetStatusDeleted, 1700, "")

	for _, cursor := range []string{"ast_missing", "ast_cross_user", "ast_cross_profile", "ast_deleted_cursor"} {
		if _, _, err := ListBytePlusAssetsForRealPerson(7, profile.Id, 2, cursor); !errors.Is(err, ErrBytePlusAssetCursorNotFound) {
			t.Fatalf("cursor %s error = %v, want ErrBytePlusAssetCursorNotFound", cursor, err)
		}
	}
}

func TestBytePlusAssetDeletionLifecycleUsesTombstoneAndLeaseCAS(t *testing.T) {
	newBytePlusAssetTestDB(t)
	active, err := CreateBytePlusAsset(BytePlusAsset{PublicId: "ast_delete", UserId: 7, ChannelId: 101, AssetType: "Image", Status: BytePlusAssetStatusActive, UpstreamAssetId: "upstream-asset", CreatedTime: 1000, UpdatedTime: 1000})
	if err != nil {
		t.Fatalf("create asset: %v", err)
	}

	begun, changed, err := BeginBytePlusAssetDeletion(7, "ast_delete", 2000)
	if err != nil {
		t.Fatalf("begin deletion: %v", err)
	}
	if !changed || begun.Status != BytePlusAssetStatusDeleting || begun.NextDeleteAt != 2000 || begun.DeleteLeaseUpdatedTime != 0 {
		t.Fatalf("begin asset=%+v changed=%v", begun, changed)
	}
	if _, _, err := BeginBytePlusAssetDeletion(8, "ast_delete", 2001); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cross-user begin error=%v, want record not found", err)
	}

	claimed, owner, err := ClaimBytePlusAssetDeletion(active.Id, 2010, 1900)
	if err != nil {
		t.Fatalf("claim deletion: %v", err)
	}
	if !owner || claimed.DeleteLeaseUpdatedTime != 2010 {
		t.Fatalf("claim asset=%+v owner=%v", claimed, owner)
	}
	_, owner, err = ClaimBytePlusAssetDeletion(active.Id, 2011, 1900)
	if err != nil {
		t.Fatalf("fresh competing claim: %v", err)
	}
	if owner {
		t.Fatal("fresh lease must not transfer ownership")
	}
	if ok, err := CompleteBytePlusAssetDeletion(active.Id, 9999, 2020); err != nil || ok {
		t.Fatalf("stale complete ok=%v err=%v", ok, err)
	}
	if ok, err := RetryBytePlusAssetDeletion(active.Id, 2010, 2030, 2025); err != nil || !ok {
		t.Fatalf("retry ok=%v err=%v", ok, err)
	}
	var retried BytePlusAsset
	if err := DB.First(&retried, active.Id).Error; err != nil {
		t.Fatalf("reload retried: %v", err)
	}
	if retried.Status != BytePlusAssetStatusDeleting || retried.DeleteAttempts != 1 || retried.DeleteLeaseUpdatedTime != 0 || retried.NextDeleteAt != 2030 {
		t.Fatalf("retried asset = %+v", retried)
	}
	claimed, owner, err = ClaimBytePlusAssetDeletion(active.Id, 2040, 1900)
	if err != nil || !owner {
		t.Fatalf("second claim asset=%+v owner=%v err=%v", claimed, owner, err)
	}
	if ok, err := CompleteBytePlusAssetDeletion(active.Id, claimed.DeleteLeaseUpdatedTime, 2050); err != nil || !ok {
		t.Fatalf("complete ok=%v err=%v", ok, err)
	}
	var deleted BytePlusAsset
	if err := DB.First(&deleted, active.Id).Error; err != nil {
		t.Fatalf("reload deleted: %v", err)
	}
	if deleted.Status != BytePlusAssetStatusDeleted || deleted.DeletedTime != 2050 {
		t.Fatalf("deleted asset = %+v", deleted)
	}
}

func TestCompleteBytePlusAssetDeletionSchedulesLinkedPendingTempCleanup(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	asset := BytePlusAsset{PublicId: "ast_delete_cleanup", UserId: 7, ChannelId: 101, AssetType: "Image", Status: BytePlusAssetStatusDeleting, NextDeleteAt: 100, DeleteLeaseUpdatedTime: 222, CreatedTime: 100, UpdatedTime: 100}
	if err := DB.Create(&asset).Error; err != nil {
		t.Fatalf("create asset: %v", err)
	}
	object := BytePlusAssetTempObject{AssetId: &asset.Id, UserId: 7, ChannelId: 101, Bucket: "bucket", ObjectKey: "delete-cleanup", CleanupStatus: BytePlusTempObjectCleanupPending, NextCleanupAt: 5000, CleanupLeaseUpdatedTime: 333, CreatedTime: 100, UpdatedTime: 100}
	if err := DB.Create(&object).Error; err != nil {
		t.Fatalf("create temp object: %v", err)
	}

	ok, err := CompleteBytePlusAssetDeletion(asset.Id, 222, 2050)
	if err != nil || !ok {
		t.Fatalf("complete deletion ok=%v err=%v", ok, err)
	}

	if err := DB.First(&object, object.Id).Error; err != nil {
		t.Fatalf("reload temp object: %v", err)
	}
	if object.NextCleanupAt != 2050 || object.CleanupLeaseUpdatedTime != 0 || object.UpdatedTime != 2050 {
		t.Fatalf("deleted asset did not schedule temp cleanup: %+v", object)
	}
}

func insertModelRealPersonAsset(t *testing.T, publicID string, userID int, profileID int64, status string, created int64, failureCode string) {
	t.Helper()
	if err := DB.Create(&BytePlusAsset{
		PublicId: publicID, UserId: userID, RealPersonProfileId: &profileID, ChannelId: 101,
		AssetType: "Image", Name: publicID, Status: status, FailureCode: failureCode,
		CreatedTime: created, UpdatedTime: created,
	}).Error; err != nil {
		t.Fatalf("insert real-person asset: %v", err)
	}
}

func assetPublicIDs(assets []BytePlusAsset) string {
	ids := make([]string, 0, len(assets))
	for _, asset := range assets {
		ids = append(ids, asset.PublicId)
	}
	return strings.Join(ids, ",")
}

func newBytePlusAssetTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&BytePlusAssetGroup{}, &BytePlusAsset{}, &BytePlusAssetTempObject{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sqlite handle: %v", err)
	}
	oldDB := DB
	DB = db
	t.Cleanup(func() {
		DB = oldDB
		_ = sqlDB.Close()
	})
	return db
}
