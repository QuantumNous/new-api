package model

import (
	"errors"
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

// batchUpdateRetries holds batches that were already made durable in the
// write-ahead log but whose database transaction failed. They keep their
// original batch id so a retry can never apply the same deltas twice.
var (
	batchUpdateRetriesLock sync.Mutex
	batchUpdateRetries     []*batchOutboxBatch
)

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

// batchUpdate persists the accumulated deltas.
//
// The deltas are staged in the write-ahead outbox before the database is
// touched, and they are only removed from memory (or handed to the retry queue)
// once that staging is durable. A failed database transaction therefore retries
// the same batch instead of dropping it, and a crash between two intervals
// replays the staged deltas on the next start.
func batchUpdate() {
	if !hasPendingBatchUpdates() {
		return
	}
	common.SysLog(common.LogText("batch update started"))
	flushBatchUpdateRetries()
	if err := stageBatchUpdateSnapshot(); err != nil {
		common.SysError(common.LogText("batch update failed: %s", err.Error()))
	}
	common.SysLog(common.LogText("batch update finished"))
}

func hasPendingBatchUpdates() bool {
	if pendingBatchRetryCount() > 0 {
		return true
	}
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		empty := len(batchUpdateStores[i]) == 0
		batchUpdateLocks[i].Unlock()
		if !empty {
			return true
		}
	}
	return false
}

// copyBatchUpdateStores snapshots the accumulated deltas without clearing them.
// Concurrent updates keep landing in the live maps and stay queued for the next
// flush.
func copyBatchUpdateStores() []map[int]int {
	snapshot := make([]map[int]int, BatchUpdateTypeCount)
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		if len(batchUpdateStores[i]) == 0 {
			batchUpdateLocks[i].Unlock()
			continue
		}
		store := make(map[int]int, len(batchUpdateStores[i]))
		for id, value := range batchUpdateStores[i] {
			store[id] = value
		}
		batchUpdateLocks[i].Unlock()
		snapshot[i] = store
	}
	return snapshot
}

// drainBatchUpdateStores removes exactly the snapshot values from the live
// maps. Updates that arrived while the snapshot was being persisted survive.
func drainBatchUpdateStores(snapshot []map[int]int) {
	for i := range BatchUpdateTypeCount {
		if len(snapshot[i]) == 0 {
			continue
		}
		batchUpdateLocks[i].Lock()
		for id, value := range snapshot[i] {
			current, ok := batchUpdateStores[i][id]
			if !ok {
				continue
			}
			remaining := current - value
			if remaining == 0 {
				delete(batchUpdateStores[i], id)
				continue
			}
			batchUpdateStores[i][id] = remaining
		}
		batchUpdateLocks[i].Unlock()
	}
}

func snapshotHasData(snapshot []map[int]int) bool {
	for i := range snapshot {
		if len(snapshot[i]) > 0 {
			return true
		}
	}
	return false
}

// stageBatchUpdateSnapshot moves one snapshot through the durable write-ahead
// log and into the database.
func stageBatchUpdateSnapshot() error {
	snapshot := copyBatchUpdateStores()
	if !snapshotHasData(snapshot) {
		return nil
	}

	batchID := newBatchID()
	outbox, outboxErr := getBatchOutbox()
	if outboxErr != nil || outbox == nil {
		// Without a durable staging area the deltas stay in memory until the
		// database confirms them, so nothing is lost on a failed flush.
		if err := applyBatchQuotaDeltas(batchID, snapshot); err != nil && !errors.Is(err, errBatchAlreadyApplied) {
			return err
		}
		drainBatchUpdateStores(snapshot)
		return nil
	}

	if err := outbox.stage(batchID, snapshot); err != nil {
		// Nothing was persisted, so keep the deltas queued for the next tick.
		return err
	}

	if err := applyBatchQuotaDeltas(batchID, snapshot); err != nil && !errors.Is(err, errBatchAlreadyApplied) {
		drainBatchUpdateStores(snapshot)
		enqueueBatchUpdateRetry(outbox, &batchOutboxBatch{id: batchID, stores: snapshot})
		return err
	}
	drainBatchUpdateStores(snapshot)
	if err := outbox.commit(batchID); err != nil {
		common.SysError(common.LogText("failed to compact the batch quota outbox: %s", err.Error()))
	}
	return nil
}

func enqueueBatchUpdateRetry(outbox *batchOutbox, batch *batchOutboxBatch) {
	if outbox != nil {
		outbox.mu.Lock()
		// The staged records are still on disk and must stay there until the
		// retried transaction commits.
		outbox.pending[batch.id] = struct{}{}
		outbox.mu.Unlock()
	}
	batchUpdateRetriesLock.Lock()
	batchUpdateRetries = append(batchUpdateRetries, batch)
	batchUpdateRetriesLock.Unlock()
}

func pendingBatchRetryCount() int {
	batchUpdateRetriesLock.Lock()
	defer batchUpdateRetriesLock.Unlock()
	return len(batchUpdateRetries)
}

func flushBatchUpdateRetries() {
	batchUpdateRetriesLock.Lock()
	retries := batchUpdateRetries
	batchUpdateRetries = nil
	batchUpdateRetriesLock.Unlock()
	if len(retries) == 0 {
		return
	}

	outbox, _ := getBatchOutbox()
	for _, batch := range retries {
		if err := applyBatchQuotaDeltas(batch.id, batch.stores); err != nil && !errors.Is(err, errBatchAlreadyApplied) {
			common.SysError(common.LogText("failed to retry batch quota deltas %s: %s", batch.id, err.Error()))
			enqueueBatchUpdateRetry(outbox, batch)
			continue
		}
		if outbox != nil {
			if err := outbox.commit(batch.id); err != nil {
				common.SysError(common.LogText("failed to compact the batch quota outbox: %s", err.Error()))
			}
		}
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
