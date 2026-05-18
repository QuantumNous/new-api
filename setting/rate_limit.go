package setting

import (
	"encoding/json"
	"fmt"
	"math"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var ModelRequestRateLimitEnabled = false
var ModelRequestRateLimitDurationMinutes = 1
var ModelRequestRateLimitCount = 0
var ModelRequestRateLimitSuccessCount = 1000
var ModelRequestRateLimitGroup = map[string][2]int{}
var ModelRequestConcurrencyLimitEnabled = false
var ModelRequestConcurrencyLimitCount = 0
var ModelRequestConcurrencyLimitGroup = map[string]int{}
var ModelRequestRateLimitMutex sync.RWMutex

func ModelRequestRateLimitGroup2JSONString() string {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	jsonBytes, err := json.Marshal(ModelRequestRateLimitGroup)
	if err != nil {
		common.SysLog("error marshalling model ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateModelRequestRateLimitGroupByJSONString(jsonStr string) error {
	ModelRequestRateLimitMutex.Lock()
	defer ModelRequestRateLimitMutex.Unlock()

	ModelRequestRateLimitGroup = make(map[string][2]int)
	return json.Unmarshal([]byte(jsonStr), &ModelRequestRateLimitGroup)
}

func ModelRequestConcurrencyLimitGroup2JSONString() string {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	jsonBytes, err := json.Marshal(ModelRequestConcurrencyLimitGroup)
	if err != nil {
		common.SysLog("error marshalling model request concurrency limit group: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateModelRequestConcurrencyLimitGroupByJSONString(jsonStr string) error {
	ModelRequestRateLimitMutex.Lock()
	defer ModelRequestRateLimitMutex.Unlock()

	ModelRequestConcurrencyLimitGroup = make(map[string]int)
	return json.Unmarshal([]byte(jsonStr), &ModelRequestConcurrencyLimitGroup)
}

func GetGroupRateLimit(group string) (totalCount, successCount int, found bool) {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	if ModelRequestRateLimitGroup == nil {
		return 0, 0, false
	}

	limits, found := ModelRequestRateLimitGroup[group]
	if !found {
		return 0, 0, false
	}
	return limits[0], limits[1], true
}

func GetGroupConcurrencyLimit(group string) (limit int, found bool) {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	if ModelRequestConcurrencyLimitGroup == nil {
		return 0, false
	}

	limit, found = ModelRequestConcurrencyLimitGroup[group]
	return limit, found
}

func CheckModelRequestRateLimitGroup(jsonStr string) error {
	checkModelRequestRateLimitGroup := make(map[string][2]int)
	err := json.Unmarshal([]byte(jsonStr), &checkModelRequestRateLimitGroup)
	if err != nil {
		return err
	}
	for group, limits := range checkModelRequestRateLimitGroup {
		if limits[0] < 0 || limits[1] < 1 {
			return fmt.Errorf("group %s has negative rate limit values: [%d, %d]", group, limits[0], limits[1])
		}
		if limits[0] > math.MaxInt32 || limits[1] > math.MaxInt32 {
			return fmt.Errorf("group %s [%d, %d] has max rate limits value 2147483647", group, limits[0], limits[1])
		}
	}

	return nil
}

func CheckModelRequestConcurrencyLimitGroup(jsonStr string) error {
	checkModelRequestConcurrencyLimitGroup := make(map[string]int)
	err := json.Unmarshal([]byte(jsonStr), &checkModelRequestConcurrencyLimitGroup)
	if err != nil {
		return err
	}
	for group, limit := range checkModelRequestConcurrencyLimitGroup {
		if limit < 0 {
			return fmt.Errorf("group %s has negative concurrency limit value: %d", group, limit)
		}
		if limit > math.MaxInt32 {
			return fmt.Errorf("group %s concurrency limit value %d exceeds 2147483647", group, limit)
		}
	}

	return nil
}
