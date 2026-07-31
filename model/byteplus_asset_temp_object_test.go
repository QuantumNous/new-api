package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBytePlusAssetTempObjectAllowsUnboundRowsAndUniqueBoundAsset(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	first := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "private", ObjectKey: "tmp/a", CleanupStatus: BytePlusTempObjectCleanupPending}
	second := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "private", ObjectKey: "tmp/b", CleanupStatus: BytePlusTempObjectCleanupPending}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)
	require.Nil(t, first.AssetId)
	require.Nil(t, second.AssetId)
	assetID := int64(55)
	require.NoError(t, db.Model(&first).Update("asset_id", assetID).Error)
	second.AssetId = &assetID
	require.Error(t, db.Save(&second).Error)
}

func TestBytePlusAssetTempObjectScopesObjectKeyUniquenessToBucket(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)

	first := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "a", ObjectKey: "same", CleanupStatus: BytePlusTempObjectCleanupPending}
	second := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "b", ObjectKey: "same", CleanupStatus: BytePlusTempObjectCleanupPending}
	duplicate := BytePlusAssetTempObject{UserId: 7, ChannelId: 101, Bucket: "a", ObjectKey: "same", CleanupStatus: BytePlusTempObjectCleanupPending}

	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)
	require.Error(t, db.Create(&duplicate).Error)
}
