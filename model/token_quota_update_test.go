package model

import (
	"testing"

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

func TestDirectUserQuotaFlushesPendingBatchBeforeConditionalDebit(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled, oldBatchEnabled := common.RedisEnabled, common.BatchUpdateEnabled
	common.RedisEnabled = false
	common.BatchUpdateEnabled = true
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
		common.BatchUpdateEnabled = oldBatchEnabled
	})

	user := User{Username: "pending-batch-user", Quota: 100}
	require.NoError(t, DB.Create(&user).Error)
	addNewRecord(BatchUpdateTypeUserQuota, user.Id, -80)

	err := DecreaseUserQuotaDirect(user.Id, 30)
	require.Error(t, err)

	var reloaded User
	require.NoError(t, DB.First(&reloaded, user.Id).Error)
	assert.Equal(t, 20, reloaded.Quota)
	batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
	_, pending := batchUpdateStores[BatchUpdateTypeUserQuota][user.Id]
	batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()
	assert.False(t, pending)
}
