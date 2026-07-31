package model

import (
	"strings"
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

func TestBytePlusAssetTempObjectLifecycleCASAndCleanupClaim(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	object, err := CreateBytePlusAssetTempObject(BytePlusAssetTempObject{
		UserId:                  7,
		ChannelId:               131,
		Bucket:                  "real-person-bucket",
		ObjectKey:               "real-person-assets/7/20260731/key",
		CleanupStatus:           BytePlusTempObjectCleanupPending,
		NextCleanupAt:           100,
		CleanupLeaseUpdatedTime: 100,
		CreatedTime:             100,
		UpdatedTime:             100,
	})
	require.NoError(t, err)
	require.NotZero(t, object.Id)
	require.Nil(t, object.AssetId)

	require.NoError(t, UpdateBytePlusAssetTempObjectMetadata(object.Id, strings.Repeat("a", 64), 123, "image/png", 110))
	require.NoError(t, DB.First(object, object.Id).Error)
	require.Equal(t, strings.Repeat("a", 64), object.ContentSHA256)
	require.Equal(t, int64(123), object.SizeBytes)
	require.Equal(t, "image/png", object.MimeType)
	require.Equal(t, int64(110), object.CleanupLeaseUpdatedTime)

	assetID := int64(55)
	ok, err := BindBytePlusAssetTempObject(object.Id, assetID, 500, 120)
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, DB.First(object, object.Id).Error)
	require.NotNil(t, object.AssetId)
	require.Equal(t, assetID, *object.AssetId)
	require.Equal(t, int64(500), object.NextCleanupAt)
	require.Equal(t, int64(0), object.CleanupLeaseUpdatedTime)

	ok, err = BindBytePlusAssetTempObject(object.Id, 56, 600, 121)
	require.NoError(t, err)
	require.False(t, ok)
	require.ErrorIs(t, UpdateBytePlusAssetTempObjectMetadata(object.Id, strings.Repeat("b", 64), 456, "image/jpeg", 122), ErrAPIIdempotencyCASLost)

	claimed, err := ClaimDueBytePlusTempObjectCleanups(500, 400, 10)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	require.Equal(t, object.Id, claimed[0].Id)
	require.Equal(t, BytePlusTempObjectCleanupCleaning, claimed[0].CleanupStatus)
	require.Equal(t, int64(500), claimed[0].CleanupLeaseUpdatedTime)

	ok, err = CompleteBytePlusAssetTempObjectCleanup(object.Id, 499, 510)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = CompleteBytePlusAssetTempObjectCleanup(object.Id, 500, 510)
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, DB.First(object, object.Id).Error)
	require.Equal(t, BytePlusTempObjectCleanupCleaned, object.CleanupStatus)
	require.Equal(t, int64(510), object.CleanedTime)
	require.Equal(t, int64(0), object.CleanupLeaseUpdatedTime)
}

func TestBytePlusAssetTempObjectClaimDueUsesLeaseCAS(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	insertTempObject := func(key string, next, lease int64) BytePlusAssetTempObject {
		object := BytePlusAssetTempObject{
			UserId: 7, ChannelId: 131, Bucket: "bucket", ObjectKey: key,
			CleanupStatus: BytePlusTempObjectCleanupPending, NextCleanupAt: next,
			CleanupLeaseUpdatedTime: lease, CreatedTime: next, UpdatedTime: next,
		}
		require.NoError(t, DB.Create(&object).Error)
		return object
	}
	fresh := insertTempObject("fresh", 90, 480)
	stale := insertTempObject("stale", 90, 100)
	idle := insertTempObject("idle", 90, 0)
	notDue := insertTempObject("not-due", 600, 0)

	claimed, err := ClaimDueBytePlusTempObjectCleanups(500, 400, 10)
	require.NoError(t, err)
	require.Equal(t, []int64{stale.Id, idle.Id}, tempObjectIDs(claimed))

	claimedAgain, err := ClaimDueBytePlusTempObjectCleanups(500, 400, 10)
	require.NoError(t, err)
	require.Empty(t, claimedAgain)

	var stored BytePlusAssetTempObject
	require.NoError(t, DB.First(&stored, "id = ?", fresh.Id).Error)
	require.Equal(t, BytePlusTempObjectCleanupPending, stored.CleanupStatus)
	stored = BytePlusAssetTempObject{}
	require.NoError(t, DB.First(&stored, "id = ?", notDue.Id).Error)
	require.Equal(t, BytePlusTempObjectCleanupPending, stored.CleanupStatus)
}

func TestBytePlusAssetTempObjectClaimReclaimsStaleCleaningLeaseOnce(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	staleCleaning := BytePlusAssetTempObject{
		UserId: 7, ChannelId: 131, Bucket: "bucket", ObjectKey: "stale-cleaning",
		CleanupStatus: BytePlusTempObjectCleanupCleaning, NextCleanupAt: 90,
		CleanupLeaseUpdatedTime: 100, CreatedTime: 90, UpdatedTime: 100,
	}
	freshCleaning := BytePlusAssetTempObject{
		UserId: 7, ChannelId: 131, Bucket: "bucket", ObjectKey: "fresh-cleaning",
		CleanupStatus: BytePlusTempObjectCleanupCleaning, NextCleanupAt: 90,
		CleanupLeaseUpdatedTime: 480, CreatedTime: 90, UpdatedTime: 480,
	}
	require.NoError(t, DB.Create(&staleCleaning).Error)
	require.NoError(t, DB.Create(&freshCleaning).Error)

	firstClaim, err := ClaimDueBytePlusTempObjectCleanups(500, 400, 10)
	require.NoError(t, err)
	require.Equal(t, []int64{staleCleaning.Id}, tempObjectIDs(firstClaim))
	require.Equal(t, BytePlusTempObjectCleanupCleaning, firstClaim[0].CleanupStatus)
	require.Equal(t, int64(500), firstClaim[0].CleanupLeaseUpdatedTime)

	secondClaim, err := ClaimDueBytePlusTempObjectCleanups(500, 400, 10)
	require.NoError(t, err)
	require.Empty(t, secondClaim)

	var stored BytePlusAssetTempObject
	require.NoError(t, DB.First(&stored, freshCleaning.Id).Error)
	require.Equal(t, int64(480), stored.CleanupLeaseUpdatedTime)
}

func TestBytePlusAssetTempObjectCleanupRetryRequiresCurrentLease(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	object := BytePlusAssetTempObject{
		UserId: 7, ChannelId: 131, Bucket: "bucket", ObjectKey: "retry",
		CleanupStatus: BytePlusTempObjectCleanupCleaning, CleanupLeaseUpdatedTime: 500,
		CleanupAttempts: 1, NextCleanupAt: 100, CreatedTime: 100, UpdatedTime: 500,
	}
	require.NoError(t, DB.Create(&object).Error)

	ok, err := RetryBytePlusAssetTempObjectCleanup(object.Id, 499, 900, 510)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = RetryBytePlusAssetTempObjectCleanup(object.Id, 500, 900, 510)
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, DB.First(&object, object.Id).Error)
	require.Equal(t, BytePlusTempObjectCleanupPending, object.CleanupStatus)
	require.Equal(t, 2, object.CleanupAttempts)
	require.Equal(t, int64(900), object.NextCleanupAt)
	require.Equal(t, int64(0), object.CleanupLeaseUpdatedTime)
}

func TestBytePlusAssetTempObjectFunctionsPropagateDatabaseErrors(t *testing.T) {
	oldDB := DB
	db := openBytePlusRealPersonSQLiteDB(t)
	DB = db
	t.Cleanup(func() { DB = oldDB })

	_, err := CreateBytePlusAssetTempObject(BytePlusAssetTempObject{})
	require.Error(t, err)
	require.Error(t, UpdateBytePlusAssetTempObjectMetadata(1, strings.Repeat("a", 64), 1, "image/png", 1))

	_, err = ClaimDueBytePlusTempObjectCleanups(1, 1, 1)
	require.Error(t, err)
}

func tempObjectIDs(objects []BytePlusAssetTempObject) []int64 {
	ids := make([]int64, 0, len(objects))
	for _, object := range objects {
		ids = append(ids, object.Id)
	}
	return ids
}
