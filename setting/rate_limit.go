package setting

import (
	"encoding/json"
	"fmt"
	"math"
	"one-api/common"
	"sync"
)

// Per-user rate limit settings (原有的按用户限流)
var ModelRequestRateLimitEnabled = false
var ModelRequestRateLimitDurationMinutes = 1
var ModelRequestRateLimitCount = 0
var ModelRequestRateLimitSuccessCount = 1000
var ModelRequestRateLimitGroup = map[string][2]int{}
var ModelRequestRateLimitMutex sync.RWMutex

// Per-key minute rate limit settings (按密钥的分钟级限流)
var TokenRateLimitEnabled = false
var TokenRateLimitDurationMinutes = 1
var TokenRateLimitCount = 0
var TokenRateLimitSuccessCount = 0
var TokenRateLimitGroup = map[string][2]int{}
var TokenRateLimitMutex sync.RWMutex

// Per-key daily rate limit settings (按密钥的每日限流)
var TokenDailyRateLimitEnabled = false
var TokenDailyRateLimitCount = 0          // 每日总请求数限制（0表示不限制）
var TokenDailyRateLimitSuccessCount = 0   // 每日成功请求数限制（0表示不限制）
var TokenDailyRateLimitGroup = map[string][2]int{} // 按分组的每日限制 [总请求数, 成功请求数]
var TokenDailyRateLimitMutex sync.RWMutex

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
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	ModelRequestRateLimitGroup = make(map[string][2]int)
	return json.Unmarshal([]byte(jsonStr), &ModelRequestRateLimitGroup)
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

// Token minute rate limit functions
func TokenRateLimitGroup2JSONString() string {
	TokenRateLimitMutex.RLock()
	defer TokenRateLimitMutex.RUnlock()

	jsonBytes, err := json.Marshal(TokenRateLimitGroup)
	if err != nil {
		common.SysLog("error marshalling token rate limit group: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateTokenRateLimitGroupByJSONString(jsonStr string) error {
	TokenRateLimitMutex.Lock()
	defer TokenRateLimitMutex.Unlock()

	TokenRateLimitGroup = make(map[string][2]int)
	return json.Unmarshal([]byte(jsonStr), &TokenRateLimitGroup)
}

func GetTokenRateLimit(group string) (totalCount, successCount int, found bool) {
	TokenRateLimitMutex.RLock()
	defer TokenRateLimitMutex.RUnlock()

	if TokenRateLimitGroup == nil {
		return 0, 0, false
	}

	limits, found := TokenRateLimitGroup[group]
	if !found {
		return 0, 0, false
	}
	return limits[0], limits[1], true
}

func CheckTokenRateLimitGroup(jsonStr string) error {
	checkTokenRateLimitGroup := make(map[string][2]int)
	err := json.Unmarshal([]byte(jsonStr), &checkTokenRateLimitGroup)
	if err != nil {
		return err
	}
	for group, limits := range checkTokenRateLimitGroup {
		if limits[0] < 0 || limits[1] < 0 {
			return fmt.Errorf("group %s has negative rate limit values: [%d, %d]", group, limits[0], limits[1])
		}
		if limits[0] > math.MaxInt32 || limits[1] > math.MaxInt32 {
			return fmt.Errorf("group %s [%d, %d] has max rate limits value 2147483647", group, limits[0], limits[1])
		}
	}

	return nil
}

// Token daily rate limit functions
func TokenDailyRateLimitGroup2JSONString() string {
	TokenDailyRateLimitMutex.RLock()
	defer TokenDailyRateLimitMutex.RUnlock()

	jsonBytes, err := json.Marshal(TokenDailyRateLimitGroup)
	if err != nil {
		common.SysLog("error marshalling token daily rate limit group: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateTokenDailyRateLimitGroupByJSONString(jsonStr string) error {
	TokenDailyRateLimitMutex.Lock()
	defer TokenDailyRateLimitMutex.Unlock()

	TokenDailyRateLimitGroup = make(map[string][2]int)
	return json.Unmarshal([]byte(jsonStr), &TokenDailyRateLimitGroup)
}

func GetTokenDailyRateLimit(group string) (totalCount, successCount int, found bool) {
	TokenDailyRateLimitMutex.RLock()
	defer TokenDailyRateLimitMutex.RUnlock()

	if TokenDailyRateLimitGroup == nil {
		return 0, 0, false
	}

	limits, found := TokenDailyRateLimitGroup[group]
	if !found {
		return 0, 0, false
	}
	return limits[0], limits[1], true
}

func CheckTokenDailyRateLimitGroup(jsonStr string) error {
	checkTokenDailyRateLimitGroup := make(map[string][2]int)
	err := json.Unmarshal([]byte(jsonStr), &checkTokenDailyRateLimitGroup)
	if err != nil {
		return err
	}
	for group, limits := range checkTokenDailyRateLimitGroup {
		if limits[0] < 0 || limits[1] < 0 {
			return fmt.Errorf("group %s has negative rate limit values: [%d, %d]", group, limits[0], limits[1])
		}
		if limits[0] > math.MaxInt32 || limits[1] > math.MaxInt32 {
			return fmt.Errorf("group %s [%d, %d] has max rate limits value 2147483647", group, limits[0], limits[1])
		}
	}

	return nil
}
