package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// batchUpdate 内部一旦触发 panic，必须被吞下不传播。
// 否则 flusher goroutine 会永久死亡（这就是 2026-05-18 09:04 死锁的同款机制）。
//
// 用 DB=nil 强制内部 increaseUserQuota 在 gorm 调用处 nil-pointer panic。
func TestBatchUpdate_RecoversFromInternalPanic(t *testing.T) {
	origDB := DB
	DB = nil
	t.Cleanup(func() { DB = origDB })

	addNewRecord(BatchUpdateTypeUserQuota, 1, 100)

	require.NotPanics(t, func() {
		batchUpdate()
	}, "batchUpdate must recover internal panic, never propagate")
}

func TestBatchUpdate_LegacyUserQuotaRecordCannotMutateWalletQuota(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 1)
	for i := 0; i < BatchUpdateTypeCount; i++ {
		clearBatchUpdateStoreForTest(t, i)
	}

	user := createLifecycleQuotaTestUser(t, "batch-legacy-wallet", 100, 0)
	addNewRecord(BatchUpdateTypeUserQuota, user.Id, 75)
	addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 7)
	addNewRecord(BatchUpdateTypeRequestCount, user.Id, 1)

	batchUpdate()

	var updated User
	require.NoError(t, DB.Where("id = ?", user.Id).First(&updated).Error)
	require.Equal(t, 100, updated.Quota)
	require.Equal(t, 7, updated.UsedQuota)
	require.Equal(t, 1, updated.RequestCount)
}
