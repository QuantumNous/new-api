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
var ModelRequestRateLimitMutex sync.RWMutex

// 管理员档限流：当启用模型请求限流时，是否对管理员/超级管理员（role >= RoleAdminUser）单独管控。
// ModelRequestRateLimitAdminFollowUser = true（默认）：管理员/超管跟随用户限流，行为与原先完全一致。
// = false：管理员/超管改用下面的管理员档总数/成功数，且不再套用用户档与分组覆盖；
//
//	管理员档计数为 0 表示该项不限制（即关闭对管理员/超管的限流，等同豁免）。
var ModelRequestRateLimitAdminFollowUser = true
var ModelRequestRateLimitAdminCount = 0
var ModelRequestRateLimitAdminSuccessCount = 0

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
		// 总请求数 limits[0] 是保护上游 RPM 的硬上限闸；成功请求数 limits[1] 应 >= 总数。
		// 若成功数 < 总数，成功数会成为主约束，而成功数走 check-then-act 路径存在竞态、精确性下降，
		// 多半是把两个值写反的误配。仅告警不阻断（允许有意为之的特殊配置）。
		if limits[0] > 0 && limits[1] < limits[0] {
			common.SysLog(fmt.Sprintf("warning: 分组 %s 的请求限流配置 成功数(%d) 小于 总数(%d)，建议成功数 >= 总数，否则成功数限制可能因并发竞态而不精确", group, limits[1], limits[0]))
		}
	}

	return nil
}
