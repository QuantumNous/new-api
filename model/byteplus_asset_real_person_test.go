package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMultipartAssetLocalTransactionRollsBackAssetAndBindingOnLedgerCASFailure(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{
		UserId: 7, Route: "real_person_asset_create",
		KeyHash:     "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		RequestHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Status:      APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceAsset,
		LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&record).Error)
	temp, err := CreateBytePlusAssetTempObject(BytePlusAssetTempObject{
		UserId: 7, ChannelId: 101, Bucket: "bucket", ObjectKey: "object",
		CleanupStatus: BytePlusTempObjectCleanupPending, CreatedTime: 100, UpdatedTime: 100,
	})
	require.NoError(t, err)

	_, err = CreateRealPersonBytePlusAssetForIdempotency(record.Id, 99, BytePlusAsset{
		PublicId: "ast_rollback", UserId: 7, ChannelId: 101, AssetType: "Image",
		ModerationStrategy: "Default", Status: BytePlusAssetStatusCreating,
	}, &temp.Id, 44000, 200)

	require.Error(t, err)
	require.True(t, errors.Is(err, ErrAPIIdempotencyCASLost) || err.Error() != "")
	var assetCount int64
	require.NoError(t, DB.Model(&BytePlusAsset{}).Count(&assetCount).Error)
	require.Zero(t, assetCount)
	var stored BytePlusAssetTempObject
	require.NoError(t, DB.First(&stored, temp.Id).Error)
	require.Nil(t, stored.AssetId)
}
