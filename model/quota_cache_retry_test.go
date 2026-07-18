package model

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuotaCacheDebitRebuildsOnlyWhenCacheIsUnavailable(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	oldSyncFrequency := common.SyncFrequency
	common.SyncFrequency = 60
	t.Cleanup(func() { common.SyncFrequency = oldSyncFrequency })

	user := User{Username: "quota-cache-retry-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	token := Token{
		UserId:      user.Id,
		Key:         "quota-cache-retry-token",
		Name:        "quota-cache-retry-token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
	}
	require.NoError(t, DB.Create(&token).Error)

	require.NoError(t, cacheTryDecrUserQuota(user.Id, 30))
	userCache, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 70, userCache.Quota)

	require.NoError(t, cacheTryDecrTokenQuota(token.Id, token.Key, 30))
	tokenCache, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 70, tokenCache.RemainQuota)

	userTTL, err := common.RDB.TTL(context.Background(), getUserCacheKey(user.Id)).Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, userTTL, 59*time.Second)
}

func TestQuotaCacheDebitDoesNotRetryInsufficientQuota(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	oldSyncFrequency := common.SyncFrequency
	common.SyncFrequency = 60
	t.Cleanup(func() { common.SyncFrequency = oldSyncFrequency })

	user := User{Username: "quota-cache-insufficient-user", Quota: 10, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	err := cacheTryDecrUserQuota(user.Id, 11)
	assert.ErrorIs(t, err, common.ErrRedisQuotaInsufficient)

	userCache, cacheErr := cacheGetUserBase(user.Id)
	require.NoError(t, cacheErr)
	assert.Equal(t, 10, userCache.Quota)
}
