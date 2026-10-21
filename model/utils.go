package model

import (
	"errors"
	"fmt"
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
var batchUpdateInFlightStores []map[int]int
var batchUpdateLocks []sync.Mutex
var batchUpdateRunLock sync.Mutex

func init() {
	for range BatchUpdateTypeCount {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdateInFlightStores = append(batchUpdateInFlightStores, make(map[int]int))
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

func addNewRecordLocked(type_ int, id int, value int) {
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

func addNewRecord(type_ int, id int, value int) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	addNewRecordLocked(type_, id, value)
}

func queueUserQuotaBatchDelta(id int, delta int) error {
	batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
	defer batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()

	if common.RedisEnabled {
		owner, err := userQuotaBatchOwner()
		if err != nil {
			return err
		}
		result, err := cacheApplyUserQuotaDeltaWithBatchOwner(id, int64(delta), owner)
		if err != nil {
			return err
		}
		if result == cacheQuotaPending {
			return ErrUserQuotaMutationPending
		}
	}
	addNewRecordLocked(BatchUpdateTypeUserQuota, id, delta)
	return nil
}

func cacheTryReserveAndQueueUserQuota(id int, quota int) (cacheQuotaResult, error) {
	batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
	defer batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()

	owner, err := userQuotaBatchOwner()
	if err != nil {
		return cacheQuotaMiss, err
	}
	result, err := cacheTryReserveUserQuotaWithBatchOwner(id, int64(quota), owner)
	if err != nil || result != cacheQuotaOK {
		return result, err
	}
	addNewRecordLocked(BatchUpdateTypeUserQuota, id, -quota)
	return cacheQuotaOK, nil
}

func batchUpdate() {
	batchUpdateRunLock.Lock()
	defer batchUpdateRunLock.Unlock()

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

	if !hasData {
		return
	}

	common.SysLog(common.LogText("batch update started"))
	stores := make([]map[int]int, BatchUpdateTypeCount)
	for i := range BatchUpdateTypeCount {
		batchUpdateLocks[i].Lock()
		stores[i] = batchUpdateStores[i]
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateInFlightStores[i] = stores[i]
		batchUpdateLocks[i].Unlock()
	}
	defer func() {
		for i := 0; i < BatchUpdateTypeCount; i++ {
			batchUpdateLocks[i].Lock()
			batchUpdateInFlightStores[i] = make(map[int]int)
			batchUpdateLocks[i].Unlock()
		}
	}()

	for i, store := range stores {
		if i == BatchUpdateTypeUserQuota || i == BatchUpdateTypeUsedQuota || i == BatchUpdateTypeRequestCount {
			continue
		}
		for key, value := range store {
			switch i {
			case BatchUpdateTypeTokenQuota:
				err := increaseTokenQuota(key, value)
				if err != nil {
					common.SysLog(common.LogText("failed to batch update token quota: %s", err.Error()))
				}
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
	batchOwner, batchOwnerErr := userQuotaBatchOwner()
	for key := range userIDs {
		quota, hasQuota := userQuotaStore[key]
		usedQuota, hasUsedQuota := usedQuotaStore[key]
		requestCount, hasRequestCount := requestCountStore[key]
		if hasQuota && batchOwnerErr == nil {
			if err := refreshUserQuotaBatchPending(key, batchOwner); err != nil {
				common.SysLog(fmt.Sprintf("failed to refresh user quota batch marker for user %d: %v", key, err))
			}
		}
		if err := updateUserQuotaUsedQuotaAndRequestCount(key, quota, usedQuota, requestCount); err != nil {
			common.SysLog("failed to batch update user quota, used quota and request count: " + err.Error())
			requeueBatchUserUpdate(key, quota, hasQuota, usedQuota, hasUsedQuota, requestCount, hasRequestCount)
			continue
		}
		if hasQuota && batchOwnerErr == nil {
			batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
			_, stillQueued := batchUpdateStores[BatchUpdateTypeUserQuota][key]
			if !stillQueued {
				if err := clearUserQuotaBatchPending(key, batchOwner); err != nil {
					common.SysLog(fmt.Sprintf("failed to clear user quota batch marker for user %d: %v", key, err))
				}
			}
			batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()
		}
	}
	common.SysLog(common.LogText("batch update finished"))
}

func requeueBatchUserUpdate(id int, quota int, hasQuota bool, usedQuota int, hasUsedQuota bool, requestCount int, hasRequestCount bool) {
	if hasQuota {
		batchUpdateLocks[BatchUpdateTypeUserQuota].Lock()
		addNewRecordLocked(BatchUpdateTypeUserQuota, id, quota)
		batchUpdateLocks[BatchUpdateTypeUserQuota].Unlock()
	}
	if hasUsedQuota {
		batchUpdateLocks[BatchUpdateTypeUsedQuota].Lock()
		addNewRecordLocked(BatchUpdateTypeUsedQuota, id, usedQuota)
		batchUpdateLocks[BatchUpdateTypeUsedQuota].Unlock()
	}
	if hasRequestCount {
		batchUpdateLocks[BatchUpdateTypeRequestCount].Lock()
		addNewRecordLocked(BatchUpdateTypeRequestCount, id, requestCount)
		batchUpdateLocks[BatchUpdateTypeRequestCount].Unlock()
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
