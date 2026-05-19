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
