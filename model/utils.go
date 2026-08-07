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
var batchUpdatePendingStores []map[int]int
var batchUpdateLocks []sync.Mutex

func init() {
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdatePendingStores = append(batchUpdatePendingStores, make(map[int]int))
		batchUpdateLocks = append(batchUpdateLocks, sync.Mutex{})
	}
}

func addNewQuotaRecord(type_ int, id int, value int) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	batchUpdateStores[type_][id] += value
	if value < 0 {
		batchUpdatePendingStores[type_][id] += value
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
	stores := make([]map[int]int, BatchUpdateTypeCount)
	pendingStores := make([]map[int]int, BatchUpdateTypeCount)
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		stores[i] = batchUpdateStores[i]
		pendingStores[i] = batchUpdatePendingStores[i]
		batchUpdateStores[i] = make(map[int]int)
		batchUpdatePendingStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}

	for i, store := range stores {
		if i == BatchUpdateTypeUserQuota || i == BatchUpdateTypeUsedQuota || i == BatchUpdateTypeRequestCount {
			continue
		}
		for key, value := range store {
			switch i {
			case BatchUpdateTypeTokenQuota:
				err := increaseTokenQuota(key, value)
				if err != nil {
					common.SysLog("failed to batch update token quota: " + err.Error())
					continue
				}
				if common.RedisEnabled {
					token, err := GetTokenById(key)
					if err != nil {
						common.SysLog("failed to load token after batch quota update: " + err.Error())
						continue
					}
					if err := cacheAcknowledgeTokenQuotaPendingDelta(token.Key, int64(pendingStores[i][key])); err != nil {
						common.SysLog("failed to acknowledge token quota cache delta: " + err.Error())
					}
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
	for key := range userIDs {
		quotaDelta := userQuotaStore[key]
		_, hasQuotaUpdate := userQuotaStore[key]
		if err := updateUserQuotaUsedQuotaAndRequestCount(key, quotaDelta, usedQuotaStore[key], requestCountStore[key]); err != nil {
			continue
		}
		if common.RedisEnabled && hasQuotaUpdate {
			if err := cacheAcknowledgeUserQuotaPendingDelta(key, int64(pendingStores[BatchUpdateTypeUserQuota][key])); err != nil {
				common.SysLog("failed to acknowledge user quota cache delta: " + err.Error())
			}
		}
	}
	common.SysLog("batch update finished")
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
