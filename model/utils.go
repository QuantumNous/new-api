package model

import (
	"errors"
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
			batchUpdate()
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

func batchUpdate() {
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
		return
	}

	common.SysLog("batch update started")
	flushBatchQuotaStore(BatchUpdateTypeUserQuota, "user", increaseUserQuota)
	flushBatchQuotaStore(BatchUpdateTypeTokenQuota, "token", increaseTokenQuota)

	stores := make([]map[int]int, BatchUpdateTypeCount)
	for i := 0; i < BatchUpdateTypeCount; i++ {
		if i == BatchUpdateTypeUserQuota || i == BatchUpdateTypeTokenQuota {
			stores[i] = make(map[int]int)
			continue
		}
		batchUpdateLocks[i].Lock()
		stores[i] = batchUpdateStores[i]
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}

	for i, store := range stores {
		if i == BatchUpdateTypeUserQuota || i == BatchUpdateTypeTokenQuota || i == BatchUpdateTypeUsedQuota || i == BatchUpdateTypeRequestCount {
			continue
		}
		for key, value := range store {
			switch i {
			case BatchUpdateTypeChannelUsedQuota:
				updateChannelUsedQuota(key, value)
			}
		}
	}

	userQuotaStore := stores[BatchUpdateTypeUserQuota]
	usedQuotaStore := stores[BatchUpdateTypeUsedQuota]
	requestCountStore := stores[BatchUpdateTypeRequestCount]

	userIDs := make(map[int]struct{}, len(userQuotaStore)+len(usedQuotaStore)+len(requestCountStore))
	for key := range userQuotaStore {
		userIDs[key] = struct{}{}
	}
	for key := range usedQuotaStore {
		userIDs[key] = struct{}{}
	}
	for key := range requestCountStore {
		userIDs[key] = struct{}{}
	}
	for key := range userIDs {
		updateUserQuotaUsedQuotaAndRequestCount(key, userQuotaStore[key], usedQuotaStore[key], requestCountStore[key])
	}
	common.SysLog("batch update finished")
}

func flushBatchQuotaStore(type_ int, label string, apply func(int, int) error) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	for id, delta := range batchUpdateStores[type_] {
		if delta == 0 {
			delete(batchUpdateStores[type_], id)
			continue
		}
		if err := apply(id, delta); err != nil {
			common.SysLog("failed to batch update " + label + " quota: " + err.Error())
			continue
		}
		delete(batchUpdateStores[type_], id)
	}
}

func withFlushedBatchQuota(type_ int, id int, apply func(int, int) error, fn func() error) error {
	if !common.BatchUpdateEnabled {
		return fn()
	}
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	if pending := batchUpdateStores[type_][id]; pending != 0 {
		if err := apply(id, pending); err != nil {
			return err
		}
		delete(batchUpdateStores[type_], id)
	}
	return fn()
}

// withFlushedImageQuotaBatches serializes image settlement with local user and
// token quota batches. The fixed user-then-token order matches reservation
// refund paths and prevents a pending local spend from being hidden from the
// settlement transaction.
func withFlushedImageQuotaBatches(userID int, tokenID int, fn func() error) error {
	if fn == nil {
		return errors.New("image quota operation is required")
	}
	return withFlushedBatchQuota(BatchUpdateTypeUserQuota, userID, increaseUserQuota, func() error {
		if tokenID <= 0 {
			return fn()
		}
		return withFlushedBatchQuota(BatchUpdateTypeTokenQuota, tokenID, increaseTokenQuota, fn)
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
