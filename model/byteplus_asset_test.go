package model

import (
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestBytePlusAssetModelsAutoMigrateAndUniqueness(t *testing.T) {
	db := newBytePlusAssetTestDB(t)

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

	if err := UpdateBytePlusAssetStatus(asset.Id, BytePlusAssetStatusProcessing, "", 2030); err != nil {
		t.Fatalf("stale processing update: %v", err)
	}

	got, err := GetBytePlusAssetByPublicIDForUser(20, "ast_terminal")
	if err != nil {
		t.Fatalf("lookup asset: %v", err)
	}
	if got.Status != BytePlusAssetStatusActive || got.UpdatedTime != 2020 {
		t.Fatalf("terminal asset regressed: %+v", got)
	}
}

func newBytePlusAssetTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&BytePlusAssetGroup{}, &BytePlusAsset{}); err != nil {
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
