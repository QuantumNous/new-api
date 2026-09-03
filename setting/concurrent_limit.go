package setting

import (
	"fmt"
	"math"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var (
	ModelConcurrentLimitEnabled = false
	ModelConcurrentLimit        = 0 // 0 = unlimited
	ModelConcurrentLimitGroup   = map[string]int{}
	ModelConcurrentLimitMutex   sync.RWMutex
)

func ModelConcurrentLimitGroup2JSONString() string {
	ModelConcurrentLimitMutex.RLock()
	defer ModelConcurrentLimitMutex.RUnlock()

	jsonBytes, err := common.Marshal(ModelConcurrentLimitGroup)
	if err != nil {
		common.SysLog("error marshalling concurrent limit group: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateModelConcurrentLimitGroupByJSONString(jsonStr string) error {
	ModelConcurrentLimitMutex.Lock()
	defer ModelConcurrentLimitMutex.Unlock()

	ModelConcurrentLimitGroup = make(map[string]int)
	return common.Unmarshal([]byte(jsonStr), &ModelConcurrentLimitGroup)
}

func GetGroupConcurrentLimit(group string) (int, bool) {
	ModelConcurrentLimitMutex.RLock()
	defer ModelConcurrentLimitMutex.RUnlock()

	if ModelConcurrentLimitGroup == nil {
		return 0, false
	}
	limit, found := ModelConcurrentLimitGroup[group]
	return limit, found
}

func CheckModelConcurrentLimitGroup(jsonStr string) error {
	check := make(map[string]int)
	err := common.Unmarshal([]byte(jsonStr), &check)
	if err != nil {
		return err
	}
	for group, limit := range check {
		if limit < 0 {
			return fmt.Errorf("group %s has negative concurrent limit: %d", group, limit)
		}
		if limit > math.MaxInt32 {
			return fmt.Errorf("group %s concurrent limit %d exceeds max value 2147483647", group, limit)
		}
	}
	return nil
}
