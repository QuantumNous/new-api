package model

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"math"
	"slices"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
	"golang.org/x/sync/semaphore"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

// BatchUpdateReceipt records only the last committed batch of a process-local
// writer. It does not persist queued deltas or recover them after a crash.
// Old writer rows are retained: deleting a live writer's receipt could replay an
// uncertain commit. Storage grows by one row per process that writes a batch.
type BatchUpdateReceipt struct {
	ID      string `gorm:"primaryKey;size:64"`
	BatchID string `gorm:"not null;size:64"`
}

var batchUpdateReceiptID = common.GetRandomString(32)
var pendingBatchID string
var pendingBatchStores []map[int]int
var batchUpdateFlushLock = semaphore.NewWeighted(1)

func init() {
	for range BatchUpdateTypeCount {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdateLocks = append(batchUpdateLocks, sync.Mutex{})
	}
}

func InitBatchUpdater(ctx context.Context) <-chan struct{} {
	done := make(chan struct{})
	gopool.Go(func() {
		defer close(done)
		timer := time.NewTimer(time.Duration(common.BatchUpdateInterval) * time.Second)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				if err := batchUpdateContext(ctx); err != nil {
					common.SysError("batch update retained failed deltas for retry: " + err.Error())
				}
				timer.Reset(time.Duration(common.BatchUpdateInterval) * time.Second)
			}
		}
	})
	return done
}

// FlushBatchUpdate runs after accounting producers and the periodic writer stop.
// It resolves the old pending batch and drains newer deltas, not just one snapshot.
// This is a graceful-shutdown flush, not recovery from SIGKILL, OOM, or host loss.
func FlushBatchUpdate(ctx context.Context) error {
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		err := batchUpdateContext(ctx)
		if err == nil {
			hasData := false
			for i := range BatchUpdateTypeCount {
				batchUpdateLocks[i].Lock()
				hasData = hasData || len(batchUpdateStores[i]) > 0
				batchUpdateLocks[i].Unlock()
			}
			if !hasData {
				return nil
			}
			continue
		}
		common.SysError("final batch update failed; pending deltas retained: " + err.Error())
		select {
		case <-ctx.Done():
			return errors.Join(err, ctx.Err())
		case <-time.After(time.Second):
		}
	}
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
		common.SysError(fmt.Sprintf("batch update overflow: type=%d id=%d old=%d value=%d", type_, id, old, value))
		if value > 0 {
			sum = math.MaxInt
		} else {
			sum = math.MinInt
		}
	}
	batchUpdateStores[type_][id] = sum
}

func batchUpdate() error {
	return batchUpdateContext(context.Background())
}

func batchUpdateContext(ctx context.Context) error {
	if err := batchUpdateFlushLock.Acquire(ctx, 1); err != nil {
		return err
	}
	defer batchUpdateFlushLock.Release(1)
	if pendingBatchStores == nil {
		hasData := false
		for i := range BatchUpdateTypeCount {
			batchUpdateLocks[i].Lock()
			hasData = hasData || len(batchUpdateStores[i]) > 0
			batchUpdateLocks[i].Unlock()
		}
		if !hasData {
			return nil
		}
		pendingBatchStores = make([]map[int]int, BatchUpdateTypeCount)
		pendingBatchID = common.GetRandomString(32)
		for i := range BatchUpdateTypeCount {
			batchUpdateLocks[i].Lock()
			pendingBatchStores[i] = batchUpdateStores[i]
			batchUpdateStores[i] = make(map[int]int)
			batchUpdateLocks[i].Unlock()
		}
	}

	stores := pendingBatchStores
	common.SysLog("batch update started")
	err := applyAccountingBatch(DB.WithContext(ctx), batchUpdateReceiptID, pendingBatchID, func(tx *gorm.DB) error {
		// All writers use the same table and ID order. Other business transactions
		// may still deadlock; any SQL error retains this immutable batch for retry.
		for _, id := range slices.Sorted(maps.Keys(stores[BatchUpdateTypeTokenQuota])) {
			if err := increaseTokenQuota(tx, id, stores[BatchUpdateTypeTokenQuota][id]); err != nil {
				return err
			}
		}
		for _, id := range slices.Sorted(maps.Keys(stores[BatchUpdateTypeChannelUsedQuota])) {
			if err := updateChannelUsedQuota(tx, id, stores[BatchUpdateTypeChannelUsedQuota][id]); err != nil {
				return err
			}
		}
		userQuotaStore := stores[BatchUpdateTypeUserQuota]
		usedQuotaStore := stores[BatchUpdateTypeUsedQuota]
		requestCountStore := stores[BatchUpdateTypeRequestCount]
		userIDs := make(map[int]struct{}, len(userQuotaStore)+len(usedQuotaStore)+len(requestCountStore))
		for id := range userQuotaStore {
			userIDs[id] = struct{}{}
		}
		for id := range usedQuotaStore {
			userIDs[id] = struct{}{}
		}
		for id := range requestCountStore {
			userIDs[id] = struct{}{}
		}
		for _, id := range slices.Sorted(maps.Keys(userIDs)) {
			if err := updateUserQuotaUsedQuotaAndRequestCount(tx, id, userQuotaStore[id], usedQuotaStore[id], requestCountStore[id]); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	pendingBatchStores = nil
	pendingBatchID = ""
	common.SysLog("batch update finished")
	return nil
}

// applyAccountingBatch commits SQL increments and their receipt atomically.
// Each serialized writer retains its batch ID until the outcome is resolved.
func applyAccountingBatch(db *gorm.DB, writerID, batchID string, apply func(*gorm.DB) error) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// The old server-side COMMIT may still be finishing after the client sees
		// an error. Claim the writer first: its unique key waits even on a first
		// batch, and on SQLite acquires the write lock before any snapshot read.
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&BatchUpdateReceipt{ID: writerID, BatchID: ""}).Error; err != nil {
			return err
		}
		var receipt BatchUpdateReceipt
		// MySQL REPEATABLE READ needs a current read after waiting for the commit.
		if err := lockForUpdate(tx).Where("id = ?", writerID).Take(&receipt).Error; err != nil {
			return err
		}
		if receipt.BatchID == batchID {
			return nil
		}
		if err := apply(tx); err != nil {
			return err
		}
		return tx.Model(&BatchUpdateReceipt{}).Where("id = ?", writerID).Update("batch_id", batchID).Error
	})
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
