package model

import (
	"errors"
	"fmt"
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
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdateLocks = append(batchUpdateLocks, sync.Mutex{})
	}
}

func InitBatchUpdater() {
	gopool.Go(func() {
		for {
			time.Sleep(time.Duration(common.BatchUpdateInterval) * time.Second)
			if err := FlushBatchUpdates(); err != nil {
				common.SysLog("batch update failed and was re-queued: " + err.Error())
			}
		}
	})
}

func addNewRecord(type_ int, id int, value int) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	if _, ok := batchUpdateStores[type_][id]; !ok {
		batchUpdateStores[type_][id] = value
	} else {
		batchUpdateStores[type_][id] += value
	}
}

// FlushBatchUpdates persists every pending batch category. Failed records are
// merged back into the in-memory queue so a transient database error cannot
// silently discard accounting updates. Production billing does not rely on
// this queue, but keeping the fallback lossless makes the option safe for
// non-financial/legacy deployments.
func FlushBatchUpdates() error {
	// check if there's any data to update
	hasData := false
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		if len(batchUpdateStores[i]) > 0 {
			hasData = true
			batchUpdateLocks[i].Unlock()
			break
		}
		batchUpdateLocks[i].Unlock()
	}

	if !hasData {
		return nil
	}

	common.SysLog("batch update started")
	var flushErr error
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		store := batchUpdateStores[i]
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
		// TODO: maybe we can combine updates with same key?
		for key, value := range store {
			if err := applyBatchUpdate(i, key, value); err != nil {
				addNewRecord(i, key, value)
				flushErr = errors.Join(flushErr, err)
			}
		}
	}
	if flushErr == nil {
		common.SysLog("batch update finished")
	}
	return flushErr
}

func applyBatchUpdate(updateType int, id int, value int) error {
	switch updateType {
	case BatchUpdateTypeUserQuota:
		return increaseUserQuota(id, value)
	case BatchUpdateTypeTokenQuota:
		return increaseTokenQuota(id, value)
	case BatchUpdateTypeUsedQuota:
		return DB.Model(&User{}).Where("id = ?", id).
			Update("used_quota", gorm.Expr("used_quota + ?", value)).Error
	case BatchUpdateTypeRequestCount:
		return DB.Model(&User{}).Where("id = ?", id).
			Update("request_count", gorm.Expr("request_count + ?", value)).Error
	case BatchUpdateTypeChannelUsedQuota:
		return DB.Model(&Channel{}).Where("id = ?", id).
			Update("used_quota", gorm.Expr("used_quota + ?", value)).Error
	default:
		return fmt.Errorf("unknown batch update type %d", updateType)
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
