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

func TestRealPersonAssetOutcomeUnknownRollsBackWhenAssetCASLoss(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{
		UserId: 7, Route: "real_person_asset_create",
		KeyHash:     "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		RequestHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Status:      APIIdempotencyStatusCallingUpstream, ResourceType: APIIdempotencyResourceAsset,
		ResourcePublicId: "ast_terminal", LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&record).Error)
	asset := BytePlusAsset{
		PublicId: "ast_terminal", UserId: 7, ChannelId: 101, AssetType: "Image",
		ModerationStrategy: "Default", Status: BytePlusAssetStatusActive,
		CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&asset).Error)

	err := MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, 100, asset.Id, "idempotency_outcome_unknown", 200)

	require.ErrorIs(t, err, ErrBytePlusAssetNotUpdatable)
	require.NoError(t, DB.First(&record, record.Id).Error)
	require.Equal(t, APIIdempotencyStatusCallingUpstream, record.Status)
	require.NoError(t, DB.First(&asset, asset.Id).Error)
	require.Equal(t, BytePlusAssetStatusActive, asset.Status)
	require.Empty(t, asset.FailureCode)
}

func TestRealPersonAssetOutcomeUnknownMarksLedgerAndAssetAtomically(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{
		UserId: 7, Route: "real_person_asset_create",
		KeyHash:     "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		RequestHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Status:      APIIdempotencyStatusCallingUpstream, ResourceType: APIIdempotencyResourceAsset,
		ResourcePublicId: "ast_unknown", LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&record).Error)
	asset := BytePlusAsset{
		PublicId: "ast_unknown", UserId: 7, ChannelId: 101, AssetType: "Image",
		ModerationStrategy: "Default", Status: BytePlusAssetStatusCreating,
		CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&asset).Error)

	require.NoError(t, MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, 100, asset.Id, "custom_unknown", 200))

	require.NoError(t, DB.First(&record, record.Id).Error)
	require.Equal(t, APIIdempotencyStatusOutcomeUnknown, record.Status)
	require.NoError(t, DB.First(&asset, asset.Id).Error)
	require.Equal(t, BytePlusAssetStatusFailed, asset.Status)
	require.Equal(t, "custom_unknown", asset.FailureCode)
}
