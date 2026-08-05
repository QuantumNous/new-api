package model

import (
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAssetModelsAutoMigrateAndUniqueness(t *testing.T) {
	db := newAssetTestDB(t, &Asset{}, &AssetBinding{}, &AssetUpload{})

	asset := Asset{
		PublicId:       "asset_public_unique",
		UserId:         10,
		AssetType:      "image",
		Status:         "READY",
		SourceStatus:   "READY",
		StorageBackend: "gcs",
		StorageBucket:  "flatkey-assets",
		ObjectKey:      "users/10/asset_public_unique.png",
		ContentType:    "image/png",
		SizeBytes:      1234,
		SHA256:         "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		CreatedAt:      100,
		UpdatedAt:      100,
	}
	require.NoError(t, db.Create(&asset).Error)

	duplicatePublicID := asset
	duplicatePublicID.Id = 0
	duplicatePublicID.UserId = 11
	require.Error(t, db.Create(&duplicatePublicID).Error, "public asset IDs must be globally unique")

	binding := AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       131,
		UpstreamGroupId: "group-a",
		UpstreamAssetId: "upstream-a",
		Status:          AssetBindingStatusLeased,
		CreatedAt:       110,
		UpdatedAt:       110,
	}
	require.NoError(t, db.Create(&binding).Error)

	duplicateBinding := binding
	duplicateBinding.Id = 0
	duplicateBinding.UpstreamAssetId = "upstream-b"
	require.Error(t, db.Create(&duplicateBinding).Error, "asset/channel binding must be unique")
}

func TestAssetBindingCreateDoesNothingOnDuplicate(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{})
	asset := insertAssetForAssetTest(t, "asset_binding_duplicate")

	first, created, err := CreateAssetBindingIfAbsent(asset.Id, 131, 100)
	require.NoError(t, err)
	require.True(t, created)
	require.Equal(t, asset.Id, first.AssetId)

	second, created, err := CreateAssetBindingIfAbsent(asset.Id, 131, 200)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, first.Id, second.Id)

	var count int64
	require.NoError(t, DB.Model(&AssetBinding{}).Where("asset_id = ? AND channel_id = ?", asset.Id, 131).Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestAssetBindingLeaseTakeover(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{})
	asset := insertAssetForAssetTest(t, "asset_binding_lease")
	_, created, err := CreateAssetBindingIfAbsent(asset.Id, 131, 100)
	require.NoError(t, err)
	require.True(t, created)

	claimed, err := ClaimAssetBindingLease(asset.Id, 131, "node-a", 100, 160)
	require.NoError(t, err)
	require.True(t, claimed)

	claimed, err = ClaimAssetBindingLease(asset.Id, 131, "node-b", 120, 180)
	require.NoError(t, err)
	require.False(t, claimed, "fresh foreign lease must not be stolen")

	claimed, err = ClaimAssetBindingLease(asset.Id, 131, "node-a", 130, 190)
	require.NoError(t, err)
	require.True(t, claimed, "same owner may renew before expiry")

	claimed, err = ClaimAssetBindingLease(asset.Id, 131, "node-b", 191, 250)
	require.NoError(t, err)
	require.True(t, claimed, "expired lease can be taken over")

	var stored AssetBinding
	require.NoError(t, DB.Where("asset_id = ? AND channel_id = ?", asset.Id, 131).First(&stored).Error)
	require.Equal(t, "node-b", stored.LeaseOwner)
	require.EqualValues(t, 250, stored.LeaseExpiresAt)
	require.EqualValues(t, 3, stored.AttemptCount)
}

func TestAssetBindingLeaseDoesNotClaimActiveBinding(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{})
	asset := insertAssetForAssetTest(t, "asset_binding_active_nonclaimable")
	binding := AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       131,
		UpstreamGroupId: "group-active",
		UpstreamAssetId: "upstream-active",
		Status:          AssetStatusActive,
		LeaseOwner:      "completed",
		LeaseExpiresAt:  100,
		AttemptCount:    2,
		CreatedAt:       90,
		UpdatedAt:       100,
	}
	require.NoError(t, DB.Create(&binding).Error)

	claimed, err := ClaimAssetBindingLease(asset.Id, 131, "node-a", 200, 260)

	require.NoError(t, err)
	require.False(t, claimed)
	var stored AssetBinding
	require.NoError(t, DB.First(&stored, binding.Id).Error)
	require.Equal(t, AssetStatusActive, stored.Status)
	require.Equal(t, "completed", stored.LeaseOwner)
	require.EqualValues(t, 100, stored.LeaseExpiresAt)
	require.EqualValues(t, 2, stored.AttemptCount)
	require.Equal(t, "upstream-active", stored.UpstreamAssetId)
}

func TestAssetBindingLeaseClaimScopesExpiredLeasePredicateToTargetRow(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{})
	target := insertAssetForAssetTest(t, "asset_binding_claim_target")
	otherAsset := insertAssetForAssetTest(t, "asset_binding_claim_other")
	rows := []AssetBinding{
		{
			AssetId:        target.Id,
			ChannelId:      131,
			Status:         AssetBindingStatusPending,
			LeaseOwner:     "node-a",
			LeaseExpiresAt: 50,
			AttemptCount:   1,
			CreatedAt:      40,
			UpdatedAt:      40,
		},
		{
			AssetId:         otherAsset.Id,
			ChannelId:       131,
			Status:          AssetStatusActive,
			LeaseOwner:      "active-owner",
			LeaseExpiresAt:  0,
			AttemptCount:    2,
			UpstreamAssetId: "upstream-active",
			CreatedAt:       40,
			UpdatedAt:       40,
		},
		{
			AssetId:        otherAsset.Id,
			ChannelId:      132,
			Status:         AssetStatusFailed,
			LeaseOwner:     "failed-owner",
			LeaseExpiresAt: 0,
			AttemptCount:   3,
			ErrorCode:      "failed-before",
			CreatedAt:      40,
			UpdatedAt:      40,
		},
		{
			AssetId:        otherAsset.Id,
			ChannelId:      133,
			Status:         AssetBindingStatusLeased,
			LeaseOwner:     "stale-owner",
			LeaseExpiresAt: 1,
			AttemptCount:   4,
			CreatedAt:      40,
			UpdatedAt:      40,
		},
	}
	for i := range rows {
		require.NoError(t, DB.Create(&rows[i]).Error)
	}

	claimed, err := ClaimAssetBindingLease(target.Id, 131, "node-b", 100, 160)

	require.NoError(t, err)
	require.True(t, claimed)
	var stored []AssetBinding
	require.NoError(t, DB.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, len(rows))
	require.Equal(t, AssetBindingStatusLeased, stored[0].Status)
	require.Equal(t, "node-b", stored[0].LeaseOwner)
	require.EqualValues(t, 160, stored[0].LeaseExpiresAt)
	require.EqualValues(t, 2, stored[0].AttemptCount)
	var claimedRows int64
	require.NoError(t, DB.Model(&AssetBinding{}).Where("lease_owner = ?", "node-b").Count(&claimedRows).Error)
	require.EqualValues(t, 1, claimedRows)
	for i := 1; i < len(rows); i++ {
		require.Equal(t, rows[i].Status, stored[i].Status)
		require.Equal(t, rows[i].LeaseOwner, stored[i].LeaseOwner)
		require.Equal(t, rows[i].LeaseExpiresAt, stored[i].LeaseExpiresAt)
		require.Equal(t, rows[i].AttemptCount, stored[i].AttemptCount)
		require.Equal(t, rows[i].UpstreamAssetId, stored[i].UpstreamAssetId)
		require.Equal(t, rows[i].ErrorCode, stored[i].ErrorCode)
	}
}

func TestMigrateLegacyBytePlusAssetsPreservesPublicIDsAndBindingsIdempotently(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{}, &BytePlusAssetGroup{}, &BytePlusAsset{})

	group := BytePlusAssetGroup{
		UserId:          10,
		ChannelId:       131,
		UpstreamGroupId: "upstream-group",
		Status:          BytePlusAssetGroupStatusActive,
		CreatedTime:     90,
		UpdatedTime:     100,
	}
	require.NoError(t, DB.Create(&group).Error)

	legacy := BytePlusAsset{
		PublicId:        "ast_1234567890abcdefABCDEF1234567890",
		UserId:          10,
		AssetGroupId:    group.Id,
		ChannelId:       131,
		UpstreamAssetId: "upstream-asset",
		AssetType:       "Image",
		Status:          BytePlusAssetStatusActive,
		CreatedTime:     110,
		UpdatedTime:     120,
	}
	require.NoError(t, DB.Create(&legacy).Error)

	require.NoError(t, MigrateLegacyBytePlusAssets())
	require.NoError(t, MigrateLegacyBytePlusAssets())

	var assetCount int64
	require.NoError(t, DB.Model(&Asset{}).Where("public_id = ?", legacy.PublicId).Count(&assetCount).Error)
	require.EqualValues(t, 1, assetCount)

	var asset Asset
	require.NoError(t, DB.Where("public_id = ?", legacy.PublicId).First(&asset).Error)
	require.Equal(t, legacy.PublicId, asset.PublicId)
	require.Equal(t, legacy.UserId, asset.UserId)
	require.Equal(t, legacy.AssetType, asset.AssetType)
	require.Equal(t, legacy.Status, asset.Status)
	require.Equal(t, AssetSourceStatusUnavailable, asset.SourceStatus)
	require.Empty(t, asset.StorageBackend)
	require.Empty(t, asset.StorageBucket)
	require.Empty(t, asset.ObjectKey)
	require.EqualValues(t, legacy.CreatedTime, asset.CreatedAt)
	require.EqualValues(t, legacy.UpdatedTime, asset.UpdatedAt)

	var bindings []AssetBinding
	require.NoError(t, DB.Where("asset_id = ?", asset.Id).Find(&bindings).Error)
	require.Len(t, bindings, 1)
	require.Equal(t, legacy.ChannelId, bindings[0].ChannelId)
	require.Equal(t, group.UpstreamGroupId, bindings[0].UpstreamGroupId)
	require.Equal(t, legacy.UpstreamAssetId, bindings[0].UpstreamAssetId)
	require.Equal(t, legacy.Status, bindings[0].Status)
	require.EqualValues(t, legacy.CreatedTime, bindings[0].CreatedAt)
	require.EqualValues(t, legacy.UpdatedTime, bindings[0].UpdatedAt)
}

func TestMigrateLegacyBytePlusAssetsDoesNotRescanAlreadyMigratedRows(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{}, &BytePlusAssetGroup{}, &BytePlusAsset{}, &Option{})

	group := BytePlusAssetGroup{
		UserId:          10,
		ChannelId:       131,
		UpstreamGroupId: "upstream-group",
		Status:          BytePlusAssetGroupStatusActive,
		CreatedTime:     90,
		UpdatedTime:     100,
	}
	require.NoError(t, DB.Create(&group).Error)
	legacy := BytePlusAsset{
		PublicId:        "ast_cccccccccccccccccccccccccccccccc",
		UserId:          10,
		AssetGroupId:    group.Id,
		ChannelId:       131,
		UpstreamAssetId: "upstream-asset",
		AssetType:       "Image",
		Status:          BytePlusAssetStatusActive,
		CreatedTime:     110,
		UpdatedTime:     120,
	}
	require.NoError(t, DB.Create(&legacy).Error)

	require.NoError(t, MigrateLegacyBytePlusAssets())

	// Deleting the migrated row is a proxy for "was this row read again?".
	// A watermarked migration starts past it and leaves it alone; a full
	// rescan would re-migrate it on every process start.
	require.NoError(t, DB.Where("public_id = ?", legacy.PublicId).Delete(&Asset{}).Error)

	require.NoError(t, MigrateLegacyBytePlusAssets())

	var assetCount int64
	require.NoError(t, DB.Model(&Asset{}).Where("public_id = ?", legacy.PublicId).Count(&assetCount).Error)
	require.Zero(t, assetCount, "already migrated legacy rows must not be rescanned on later runs")
}

func TestMigrateLegacyBytePlusAssetsResumesFromWatermarkForNewRows(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{}, &BytePlusAssetGroup{}, &BytePlusAsset{}, &Option{})

	first := BytePlusAsset{
		PublicId:        "ast_dddddddddddddddddddddddddddddddd",
		UserId:          10,
		ChannelId:       131,
		UpstreamAssetId: "upstream-first",
		AssetType:       "Image",
		Status:          BytePlusAssetStatusActive,
		CreatedTime:     110,
		UpdatedTime:     120,
	}
	require.NoError(t, DB.Create(&first).Error)
	require.NoError(t, MigrateLegacyBytePlusAssets())

	second := BytePlusAsset{
		PublicId:        "ast_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
		UserId:          10,
		ChannelId:       131,
		UpstreamAssetId: "upstream-second",
		AssetType:       "Image",
		Status:          BytePlusAssetStatusActive,
		CreatedTime:     130,
		UpdatedTime:     140,
	}
	require.NoError(t, DB.Create(&second).Error)

	require.NoError(t, MigrateLegacyBytePlusAssets())

	var migrated int64
	require.NoError(t, DB.Model(&Asset{}).Where("public_id = ?", second.PublicId).Count(&migrated).Error)
	require.EqualValues(t, 1, migrated, "rows added after the watermark must still migrate")
}

func TestMigrateLegacyBytePlusAssetsSkipsRealPersonAssets(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{}, &BytePlusAssetGroup{}, &BytePlusAsset{})

	profileID := int64(42)
	legacy := BytePlusAsset{
		PublicId:            "ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		UserId:              10,
		ChannelId:           131,
		UpstreamAssetId:     "real-person-upstream",
		AssetType:           "Image",
		Status:              BytePlusAssetStatusActive,
		RealPersonProfileId: &profileID,
		CreatedTime:         110,
		UpdatedTime:         120,
	}
	require.NoError(t, DB.Create(&legacy).Error)

	require.NoError(t, MigrateLegacyBytePlusAssets())

	var assetCount int64
	require.NoError(t, DB.Model(&Asset{}).Where("public_id = ?", legacy.PublicId).Count(&assetCount).Error)
	require.Zero(t, assetCount)
	var bindingCount int64
	require.NoError(t, DB.Model(&AssetBinding{}).Count(&bindingCount).Error)
	require.Zero(t, bindingCount)
}

func TestMigrateLegacyBytePlusAssetsDoesNotOverwriteExistingGeneralizedSource(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{}, &BytePlusAssetGroup{}, &BytePlusAsset{})

	group := BytePlusAssetGroup{
		UserId:          10,
		ChannelId:       131,
		UpstreamGroupId: "upstream-group",
		Status:          BytePlusAssetGroupStatusActive,
		CreatedTime:     90,
		UpdatedTime:     100,
	}
	require.NoError(t, DB.Create(&group).Error)

	legacy := BytePlusAsset{
		PublicId:        "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		UserId:          10,
		AssetGroupId:    group.Id,
		ChannelId:       131,
		UpstreamAssetId: "upstream-asset",
		AssetType:       "Image",
		Status:          BytePlusAssetStatusActive,
		CreatedTime:     110,
		UpdatedTime:     120,
	}
	require.NoError(t, DB.Create(&legacy).Error)

	existing := Asset{
		PublicId:       legacy.PublicId,
		UserId:         legacy.UserId,
		AssetType:      legacy.AssetType,
		Status:         AssetStatusActive,
		SourceStatus:   AssetSourceStatusAvailable,
		StorageBackend: "gcs",
		StorageBucket:  "flatkey-assets",
		ObjectKey:      "objects/existing",
		CreatedAt:      1,
		UpdatedAt:      2,
	}
	require.NoError(t, DB.Create(&existing).Error)

	require.NoError(t, MigrateLegacyBytePlusAssets())

	var asset Asset
	require.NoError(t, DB.Where("public_id = ?", legacy.PublicId).First(&asset).Error)
	require.Equal(t, AssetSourceStatusAvailable, asset.SourceStatus)
	require.Equal(t, "gcs", asset.StorageBackend)
	require.Equal(t, "flatkey-assets", asset.StorageBucket)
	require.Equal(t, "objects/existing", asset.ObjectKey)
	require.EqualValues(t, existing.CreatedAt, asset.CreatedAt)
	require.EqualValues(t, existing.UpdatedAt, asset.UpdatedAt)

	var binding AssetBinding
	require.NoError(t, DB.Where("asset_id = ? AND channel_id = ?", asset.Id, legacy.ChannelId).First(&binding).Error)
	require.Equal(t, group.UpstreamGroupId, binding.UpstreamGroupId)
	require.Equal(t, legacy.UpstreamAssetId, binding.UpstreamAssetId)
	require.Equal(t, legacy.Status, binding.Status)
}

func TestAssetUploadOwnership(t *testing.T) {
	newAssetTestDB(t, &AssetUpload{})

	upload := AssetUpload{
		UploadId:       "upload_unique",
		Owner:          "user-10",
		UserId:         10,
		PublicId:       "asset_upload_target",
		AssetType:      "image",
		StorageBackend: "gcs",
		StorageBucket:  "flatkey-assets",
		ObjectKey:      "uploads/upload_unique",
		ContentType:    "image/png",
		SizeBytes:      1024,
		SHA256:         "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		ExpiresAt:      500,
		Status:         AssetUploadStatusPending,
		CreatedAt:      100,
		UpdatedAt:      100,
	}
	require.NoError(t, DB.Create(&upload).Error)

	duplicate := upload
	duplicate.Id = 0
	duplicate.Owner = "user-11"
	duplicate.UserId = 11
	require.Error(t, DB.Create(&duplicate).Error, "upload IDs must be globally unique")

	got, err := GetAssetUploadForOwner("upload_unique", "user-10")
	require.NoError(t, err)
	require.Equal(t, "asset_upload_target", got.PublicId)

	_, err = GetAssetUploadForOwner("upload_unique", "user-11")
	require.True(t, errors.Is(err, gorm.ErrRecordNotFound), "different owner must not read the upload session")
}

func TestAssetCreateAvailableAndPendingUploadThenCompleteWithOwnerCAS(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetUpload{})

	asset, err := CreateAssetWithUploadSession(Asset{
		PublicId:       "ast_pending",
		UserId:         10,
		AssetType:      "Image",
		Status:         AssetStatusCreating,
		SourceStatus:   AssetSourceStatusUnavailable,
		StorageBackend: "gcs",
		StorageBucket:  "bucket",
		ObjectKey:      "objects/pending.png",
		ContentType:    "image/png",
		SizeBytes:      123,
		CreatedAt:      100,
		UpdatedAt:      100,
	}, AssetUpload{
		UploadId:    "upl_pending",
		Owner:       "owner-a",
		UserId:      10,
		PublicId:    "ast_pending",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   123,
		ExpiresAt:   200,
		Status:      AssetUploadStatusPending,
		CreatedAt:   100,
		UpdatedAt:   100,
	})
	require.NoError(t, err)
	require.NotZero(t, asset.Id)

	completed, expired, err := CompleteAssetUploadCAS("upl_pending", "owner-b", AssetUploadCompletion{
		ContentType:     "image/png",
		SizeBytes:       123,
		SHA256:          "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		SourceExpiresAt: 300,
		Now:             150,
	})
	require.NoError(t, err)
	require.False(t, completed)
	require.False(t, expired)

	completed, expired, err = CompleteAssetUploadCAS("upl_pending", "owner-a", AssetUploadCompletion{
		ContentType:     "image/png",
		SizeBytes:       123,
		SHA256:          "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		SourceExpiresAt: 300,
		Now:             150,
	})
	require.NoError(t, err)
	require.True(t, completed)
	require.False(t, expired)

	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetStatusActive, stored.Status)
	require.Equal(t, AssetSourceStatusAvailable, stored.SourceStatus)
	require.Equal(t, "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", stored.SHA256)
	require.EqualValues(t, 300, stored.SourceExpiresAt)

	var upload AssetUpload
	require.NoError(t, DB.First(&upload, "upload_id = ?", "upl_pending").Error)
	require.Equal(t, AssetUploadStatusComplete, upload.Status)
}

func TestAssetUploadCompletionRejectsExpiredAndLoserDoesNotMutateAsset(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetUpload{})
	asset, err := CreateAssetWithUploadSession(Asset{
		PublicId:       "ast_pending_expired",
		UserId:         10,
		AssetType:      "Image",
		Status:         AssetStatusCreating,
		SourceStatus:   AssetSourceStatusUnavailable,
		StorageBackend: "gcs",
		StorageBucket:  "bucket",
		ObjectKey:      "objects/pending.png",
		ContentType:    "image/png",
		SizeBytes:      123,
		CreatedAt:      100,
		UpdatedAt:      100,
	}, AssetUpload{
		UploadId:    "upl_pending_expired",
		Owner:       "owner-a",
		UserId:      10,
		PublicId:    "ast_pending_expired",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   123,
		ExpiresAt:   150,
		Status:      AssetUploadStatusPending,
		CreatedAt:   100,
		UpdatedAt:   100,
	})
	require.NoError(t, err)

	completed, expired, err := CompleteAssetUploadCAS("upl_pending_expired", "owner-a", AssetUploadCompletion{
		ContentType:      "image/png",
		SizeBytes:        123,
		SHA256:           "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
		ObjectGeneration: 77,
		SourceExpiresAt:  300,
		Now:              150,
	})
	require.NoError(t, err)
	require.False(t, completed)
	require.True(t, expired)

	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetStatusCreating, stored.Status)
	require.Empty(t, stored.SHA256)
	require.Zero(t, stored.ObjectGeneration)

	var upload AssetUpload
	require.NoError(t, DB.First(&upload, "upload_id = ?", "upl_pending_expired").Error)
	require.Equal(t, AssetUploadStatusPending, upload.Status, "expired-at-CAS must stay claimable for generation-aware cleanup")

	require.NoError(t, DB.Model(&AssetUpload{}).Where("upload_id = ?", "upl_pending_expired").Updates(map[string]any{
		"expires_at": int64(250),
	}).Error)
	completed, expired, err = CompleteAssetUploadCAS("upl_pending_expired", "owner-a", AssetUploadCompletion{
		ContentType:      "image/png",
		SizeBytes:        123,
		SHA256:           "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
		ObjectGeneration: 88,
		SourceExpiresAt:  400,
		Now:              200,
	})
	require.NoError(t, err)
	require.True(t, completed)
	require.False(t, expired)
	completed, expired, err = CompleteAssetUploadCAS("upl_pending_expired", "owner-a", AssetUploadCompletion{
		ContentType:      "image/png",
		SizeBytes:        123,
		SHA256:           "9999999999999999999999999999999999999999999999999999999999999999",
		ObjectGeneration: 99,
		SourceExpiresAt:  500,
		Now:              201,
	})
	require.NoError(t, err)
	require.False(t, completed)
	require.False(t, expired)

	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", stored.SHA256)
	require.EqualValues(t, 88, stored.ObjectGeneration)
	require.EqualValues(t, 400, stored.SourceExpiresAt)
}

func TestAssetUploadFailureMarksUploadAndAssetTerminalOnce(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetUpload{})
	asset, err := CreateAssetWithUploadSession(Asset{
		PublicId:       "ast_failed_upload",
		UserId:         10,
		AssetType:      "Image",
		Status:         AssetStatusCreating,
		SourceStatus:   AssetSourceStatusUnavailable,
		StorageBackend: "gcs",
		StorageBucket:  "bucket",
		ObjectKey:      "objects/failed.png",
		CreatedAt:      100,
		UpdatedAt:      100,
	}, AssetUpload{
		UploadId:  "upl_failed",
		Owner:     "owner-a",
		ExpiresAt: 200,
		Status:    AssetUploadStatusPending,
		CreatedAt: 100,
		UpdatedAt: 100,
	})
	require.NoError(t, err)

	failed, err := FailAssetUploadCAS("upl_failed", "owner-b", AssetUploadFailure{
		Now:              150,
		SourceStatus:     AssetSourceStatusUnavailable,
		ObjectGeneration: 77,
		ClearStorage:     true,
	})
	require.NoError(t, err)
	require.False(t, failed)

	failed, err = FailAssetUploadCAS("upl_failed", "owner-a", AssetUploadFailure{
		Now:              150,
		SourceStatus:     AssetSourceStatusUnavailable,
		ObjectGeneration: 77,
		ClearStorage:     true,
	})
	require.NoError(t, err)
	require.True(t, failed)

	failed, err = FailAssetUploadCAS("upl_failed", "owner-a", AssetUploadFailure{
		Now:              151,
		SourceStatus:     AssetSourceStatusCleanupPending,
		ObjectGeneration: 88,
	})
	require.NoError(t, err)
	require.False(t, failed)

	var upload AssetUpload
	require.NoError(t, DB.First(&upload, "upload_id = ?", "upl_failed").Error)
	require.Equal(t, AssetUploadStatusFailed, upload.Status)
	require.EqualValues(t, 77, upload.ObjectGeneration)
	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetStatusFailed, stored.Status)
	require.Equal(t, AssetSourceStatusUnavailable, stored.SourceStatus)
	require.Empty(t, stored.ObjectKey)
	require.Zero(t, stored.ObjectGeneration)
}

func TestAssetBindingActivationLocksAssetAndDoesNotLoseActivation(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{})
	asset := insertAssetForAssetTest(t, "asset_binding_activate")
	require.NoError(t, DB.Model(&Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"status":        AssetStatusActive,
		"source_status": AssetSourceStatusAvailable,
	}).Error)
	binding := AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       131,
		UpstreamAssetId: "upstream-a",
		Status:          AssetBindingStatusLeased,
		LeaseOwner:      "node-a",
		LeaseExpiresAt:  200,
		CreatedAt:       100,
		UpdatedAt:       100,
	}
	require.NoError(t, DB.Create(&binding).Error)
	require.NoError(t, DB.Model(&Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"cleanup_lease_owner": "cleanup",
		"cleanup_generation":  int64(3),
	}).Error)

	activated, err := ActivateAssetBindingWithAssetCAS(AssetBindingActivation{
		AssetID:         asset.Id,
		ChannelID:       131,
		LeaseOwner:      "node-a",
		UpstreamGroupID: "group-a",
		UpstreamAssetID: "upstream-a",
		Now:             160,
	})
	require.NoError(t, err)
	require.True(t, activated)

	ok, err := MarkAssetSourceExpiredIfCleanupLease(asset.Id, "cleanup", 3, 170)
	require.NoError(t, err)
	require.True(t, ok)

	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetStatusActive, stored.Status)
	require.Equal(t, AssetSourceStatusExpired, stored.SourceStatus)
	var storedBinding AssetBinding
	require.NoError(t, DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, AssetStatusActive, storedBinding.Status)
}

func TestAssetCleanupLeaseClaimAndGenerationFencing(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetBinding{})
	asset := insertAssetForAssetTest(t, "asset_cleanup_lease")
	require.NoError(t, DB.Model(&Asset{}).Where("id = ?", asset.Id).Updates(map[string]any{
		"status":              AssetStatusActive,
		"source_status":       AssetSourceStatusAvailable,
		"source_expires_at":   int64(100),
		"cleanup_lease_owner": "node-stale",
		"cleanup_lease_until": int64(90),
		"cleanup_generation":  int64(2),
	}).Error)

	claimed, err := ClaimExpiredAssetSources("node-a", 150, 210, 10)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.EqualValues(t, 3, claimed[0].CleanupGeneration)

	ok, err := MarkAssetSourceExpiredIfCleanupLease(claimed[0].Id, "node-b", claimed[0].CleanupGeneration, 200)
	require.NoError(t, err)
	require.False(t, ok)

	ok, err = MarkAssetSourceExpiredIfCleanupLease(claimed[0].Id, "node-a", claimed[0].CleanupGeneration, 200)
	require.NoError(t, err)
	require.True(t, ok)
	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetSourceStatusExpired, stored.SourceStatus)
	require.Equal(t, AssetStatusExpired, stored.Status)
}

func TestAssetUploadCleanupClaimMovesUploadToCleaningBeforeExternalDelete(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetUpload{})
	asset, err := CreateAssetWithUploadSession(Asset{
		PublicId:       "ast_upload_cleanup_claim",
		UserId:         10,
		AssetType:      "Image",
		Status:         AssetStatusCreating,
		SourceStatus:   AssetSourceStatusUnavailable,
		StorageBackend: "gcs",
		StorageBucket:  "bucket",
		ObjectKey:      "objects/upload-cleanup.png",
		ContentType:    "image/png",
		SizeBytes:      123,
		CreatedAt:      100,
		UpdatedAt:      100,
	}, AssetUpload{
		UploadId:    "upl_cleanup_claim",
		Owner:       "owner-a",
		UserId:      10,
		PublicId:    "ast_upload_cleanup_claim",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   123,
		ExpiresAt:   150,
		Status:      AssetUploadStatusPending,
		CreatedAt:   100,
		UpdatedAt:   100,
	})
	require.NoError(t, err)

	claimed, err := ClaimExpiredPendingAssetUploads("cleanup-a", 200, 260, 10)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.Equal(t, "upl_cleanup_claim", claimed[0].Upload.UploadId)
	require.Equal(t, AssetUploadStatusCleaning, claimed[0].Upload.Status)
	require.Equal(t, "cleanup-a", claimed[0].Upload.CleanupLeaseOwner)
	require.EqualValues(t, 260, claimed[0].Upload.CleanupLeaseUntil)
	require.EqualValues(t, 1, claimed[0].Upload.CleanupGeneration)
	require.Equal(t, "cleanup-a", claimed[0].Asset.CleanupLeaseOwner)
	require.EqualValues(t, 260, claimed[0].Asset.CleanupLeaseUntil)
	require.EqualValues(t, 1, claimed[0].Asset.CleanupGeneration)

	completed, expired, err := CompleteAssetUploadCAS("upl_cleanup_claim", "owner-a", AssetUploadCompletion{
		ContentType:      "image/png",
		SizeBytes:        123,
		SHA256:           "abababababababababababababababababababababababababababababababab",
		ObjectGeneration: 9,
		SourceExpiresAt:  400,
		Now:              210,
	})
	require.NoError(t, err)
	require.False(t, completed, "cleanup-owned upload must never be activated after claim")
	require.False(t, expired)

	ok, err := MarkExpiredPendingAssetUploadIfCleanupLease("upl_cleanup_claim", "cleanup-a", 1, 9, 220)
	require.NoError(t, err)
	require.True(t, ok)

	var upload AssetUpload
	require.NoError(t, DB.First(&upload, "upload_id = ?", "upl_cleanup_claim").Error)
	require.Equal(t, AssetUploadStatusExpired, upload.Status)
	require.EqualValues(t, 9, upload.ObjectGeneration)
	require.Equal(t, "cleanup-a", upload.CleanupLeaseOwner)
	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetStatusExpired, stored.Status)
	require.Equal(t, AssetSourceStatusExpired, stored.SourceStatus)
	require.Empty(t, stored.ObjectKey)
	require.Zero(t, stored.ObjectGeneration)
}

func TestAssetUploadCleanupLeaseTakeoverAndGenerationFencing(t *testing.T) {
	newAssetTestDB(t, &Asset{}, &AssetUpload{})
	asset, err := CreateAssetWithUploadSession(Asset{
		PublicId:          "ast_upload_cleanup_takeover",
		UserId:            10,
		AssetType:         "Image",
		Status:            AssetStatusCreating,
		SourceStatus:      AssetSourceStatusUnavailable,
		StorageBackend:    "gcs",
		StorageBucket:     "bucket",
		ObjectKey:         "objects/upload-takeover.png",
		ContentType:       "image/png",
		SizeBytes:         123,
		CleanupLeaseOwner: "stale-cleanup",
		CleanupLeaseUntil: 190,
		CleanupGeneration: 2,
		CreatedAt:         100,
		UpdatedAt:         100,
	}, AssetUpload{
		UploadId:          "upl_cleanup_takeover",
		Owner:             "owner-a",
		UserId:            10,
		PublicId:          "ast_upload_cleanup_takeover",
		AssetType:         "Image",
		ContentType:       "image/png",
		SizeBytes:         123,
		ExpiresAt:         150,
		Status:            AssetUploadStatusCleaning,
		CleanupLeaseOwner: "stale-cleanup",
		CleanupLeaseUntil: 190,
		CleanupGeneration: 2,
		CreatedAt:         100,
		UpdatedAt:         100,
	})
	require.NoError(t, err)

	claimed, err := ClaimExpiredPendingAssetUploads("cleanup-b", 200, 260, 10)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.EqualValues(t, 3, claimed[0].Upload.CleanupGeneration)
	require.EqualValues(t, 3, claimed[0].Asset.CleanupGeneration)

	ok, err := MarkExpiredPendingAssetUploadIfCleanupLease("upl_cleanup_takeover", "stale-cleanup", 2, 8, 210)
	require.NoError(t, err)
	require.False(t, ok, "stale cleanup owner/generation must be fenced after takeover")

	ok, err = MarkExpiredPendingAssetUploadIfCleanupLease("upl_cleanup_takeover", "cleanup-b", 3, 9, 220)
	require.NoError(t, err)
	require.True(t, ok)

	var upload AssetUpload
	require.NoError(t, DB.First(&upload, "upload_id = ?", "upl_cleanup_takeover").Error)
	require.Equal(t, AssetUploadStatusExpired, upload.Status)
	require.EqualValues(t, 9, upload.ObjectGeneration)
	require.Equal(t, "cleanup-b", upload.CleanupLeaseOwner)
	var stored Asset
	require.NoError(t, DB.First(&stored, asset.Id).Error)
	require.Equal(t, AssetSourceStatusExpired, stored.SourceStatus)
	require.EqualValues(t, asset.Id, stored.Id)
}

func newAssetTestDB(t *testing.T, models ...interface{}) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(models...))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	oldDB := DB
	DB = db
	t.Cleanup(func() {
		DB = oldDB
		_ = sqlDB.Close()
	})
	return db
}

func insertAssetForAssetTest(t *testing.T, publicID string) Asset {
	t.Helper()
	asset := Asset{
		PublicId:       publicID,
		UserId:         10,
		AssetType:      "image",
		Status:         "READY",
		SourceStatus:   "READY",
		StorageBackend: "gcs",
		StorageBucket:  "flatkey-assets",
		ObjectKey:      "objects/" + publicID,
		ContentType:    "image/png",
		SizeBytes:      123,
		SHA256:         "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
		CreatedAt:      100,
		UpdatedAt:      100,
	}
	require.NoError(t, DB.Create(&asset).Error)
	return asset
}
