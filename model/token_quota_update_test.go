package model

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestTokenSelectUpdateDoesNotRestoreStaleQuota(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	token := Token{
		UserId:      1,
		Key:         "status-only-token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
	}
	require.NoError(t, DB.Create(&token).Error)

	stale := token
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
		"remain_quota": gorm.Expr("remain_quota - ?", 25),
		"used_quota":   gorm.Expr("used_quota + ?", 25),
	}).Error)

	stale.Status = common.TokenStatusDisabled
	require.NoError(t, stale.SelectUpdate())

	var reloaded Token
	require.NoError(t, DB.First(&reloaded, token.Id).Error)
	assert.Equal(t, 75, reloaded.RemainQuota)
	assert.Equal(t, 25, reloaded.UsedQuota)
	assert.Equal(t, common.TokenStatusDisabled, reloaded.Status)
}

func TestTokenUpdatePreservesPinnedQuotaCache(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	oldSyncFrequency, oldBatchEnabled := common.SyncFrequency, common.BatchUpdateEnabled
	common.SyncFrequency = 60
	common.BatchUpdateEnabled = true
	t.Cleanup(func() {
		common.SyncFrequency = oldSyncFrequency
		common.BatchUpdateEnabled = oldBatchEnabled
	})

	token := Token{
		UserId:      1,
		Key:         "pinned-token-update",
		Name:        "before",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
	}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, cacheSetToken(token))

	tokenHMAC := common.GenerateHMAC(token.Key)
	cacheKey := "token:" + tokenHMAC
	_, err := redisServer.SAdd(imageTaskTokenQuotaPinsKey(tokenHMAC), "task-1")
	require.NoError(t, err)
	require.NoError(t, common.RDB.Expire(context.Background(), cacheKey, 7*24*time.Hour).Err())

	token.Name = "after"
	require.NoError(t, token.Update())

	cacheTTL, err := common.RDB.TTL(context.Background(), cacheKey).Result()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, cacheTTL, 6*24*time.Hour)
	assert.Equal(t, strconv.Itoa(common.TokenStatusDisabled), redisServer.HGet(cacheKey, "Status"))
	assert.True(t, redisServer.Exists(imageTaskTokenQuotaInvalidationKey(tokenHMAC)))
}
