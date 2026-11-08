package model

import (
	"errors"
	"maps"
	"math"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	BatchUpdateTypeUserQuota = iota
	BatchUpdateTypeTokenQuota
	BatchUpdateTypeUsedQuota
	BatchUpdateTypeChannelUsedQuota
	BatchUpdateTypeRequestCount
	BatchUpdateTypeCount // if you add a new type, you need to add a new map and a new lock
)

var batchUpdateStores []map[int]int
var batchUpdateLocks []sync.Mutex

func init() {
	for range BatchUpdateTypeCount {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdateLocks = append(batchUpdateLocks, sync.Mutex{})
	}
}

func InitBatchUpdater() {
	gopool.Go(func() {
		for {
			time.Sleep(time.Duration(common.BatchUpdateInterval) * time.Second)
			batchUpdate()
		}
	})
}

func addNewRecord(type_ int, id int, value int) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	old, ok := batchUpdateStores[type_][id]
	if !ok {
		batchUpdateStores[type_][id] = value
		return
	}

	sum := old + value
	if (value > 0 && sum < old) || (value < 0 && sum > old) {
		common.SysError(common.LogText("batch update overflow: type=%d id=%d old=%d value=%d", type_, id, old, value))
		if value > 0 {
			sum = math.MaxInt
		} else {
			sum = math.MinInt
		}
	}
	batchUpdateStores[type_][id] = sum
}

func batchUpdate() {
	// check if there's any data to update
	hasData := false
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		if len(batchUpdateStores[i]) > 0 {
			hasData = true
			batchUpdateLocks[i].Unlock()
			break
		}
		batchUpdateLocks[i].Unlock()
	}

	if hasData {
		common.SysLog(common.LogText("batch update started"))
		// 先把内存快照持久化到 outbox，成功后才从内存中移除；持久化失败时
		// 增量原样保留，下一轮继续尝试，绝不静默丢失。
		stores := snapshotBatchUpdateStores()
		if err := enqueueQuotaOutbox(stores); err != nil {
			common.SysError(common.LogText("failed to persist batch quota increments to the outbox: %s", err.Error()))
			return
		}
		clearFlushedBatchUpdateStores(stores)
	}

	// 应用（包括上一轮失败后按退避重试的）待处理增量。
	processPendingQuotaOutbox(quotaOutboxProcessLimit)
	cleanupProcessedQuotaOutbox()

	if hasData {
		common.SysLog(common.LogText("batch update finished"))
	}
}

// FlushBatchUpdates 在进程退出前把内存中的待刷新增量持久化到 outbox 并尽力
// 应用，缩小批量模式下未落库增量的窗口。批量更新未启用时不做任何事。
func FlushBatchUpdates() {
	if !common.BatchUpdateEnabled {
		return
	}
	batchUpdate()
}

// snapshotBatchUpdateStores 在不阻塞累加的前提下复制待刷新的增量。复制完成后
// 新到达的增量仍会进入原 map，由 clearFlushedBatchUpdateStores 精确减去已持久化
// 的部分。
func snapshotBatchUpdateStores() []map[int]int {
	stores := make([]map[int]int, BatchUpdateTypeCount)
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		if len(batchUpdateStores[i]) == 0 {
			batchUpdateLocks[i].Unlock()
			continue
		}
		copied := make(map[int]int, len(batchUpdateStores[i]))
		maps.Copy(copied, batchUpdateStores[i])
		stores[i] = copied
		batchUpdateLocks[i].Unlock()
	}
	return stores
}

// clearFlushedBatchUpdateStores 只从内存中移除已经写入 outbox 的增量。快照之后
// 新累积的增量保留在 map 中，等待下一轮刷新。
func clearFlushedBatchUpdateStores(stores []map[int]int) {
	for i := range BatchUpdateTypeCount {
		if len(stores[i]) == 0 {
			continue
		}
		batchUpdateLocks[i].Lock()
		for id, value := range stores[i] {
			current, ok := batchUpdateStores[i][id]
			if !ok {
				continue
			}
			if remaining := current - value; remaining != 0 {
				batchUpdateStores[i][id] = remaining
			} else {
				delete(batchUpdateStores[i], id)
			}
		}
		batchUpdateLocks[i].Unlock()
	}
}

func RecordExist(err error) (bool, error) {
	if err == nil {
		return true, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return false, err
}

func shouldUpdateRedis(fromDB bool, err error) bool {
	return common.RedisEnabled && fromDB && err == nil
}
