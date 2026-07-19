package model

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuotaMutationsRemainDurableWhenRedisIsLost(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	oldSyncFrequency, oldBatchUpdateEnabled := common.SyncFrequency, common.BatchUpdateEnabled
	common.SyncFrequency = 60
	common.BatchUpdateEnabled = true
	t.Cleanup(func() {
		common.SyncFrequency = oldSyncFrequency
		common.BatchUpdateEnabled = oldBatchUpdateEnabled
	})

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
	require.NoError(t, populateUserCache(user))
	require.NoError(t, cacheSetTokenIfAbsent(token))

	require.NoError(t, DecreaseUserQuota(user.Id, 30, false))
	require.NoError(t, DecreaseTokenQuota(token.Id, token.Key, 30))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 70, storedUser.Quota)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 70, storedToken.RemainQuota)

	require.NoError(t, common.RDB.FlushDB(context.Background()).Err())

	require.NoError(t, DecreaseUserQuota(user.Id, 30, false))
	require.NoError(t, DecreaseTokenQuota(token.Id, token.Key, 30))

	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 40, storedUser.Quota)
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 40, storedToken.RemainQuota)
}
