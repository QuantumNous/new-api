package setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var userUsableGroups = map[string]string{
	"default": "默认分组",
	"vip":     "vip分组",
}
var userUsableGroupsMutex sync.RWMutex

func GetUserUsableGroupsCopy() map[string]string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	copyUserUsableGroups := make(map[string]string)
	for k, v := range userUsableGroups {
		copyUserUsableGroups[k] = v
	}
	return copyUserUsableGroups
}

func UserUsableGroups2JSONString() string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	jsonBytes, err := common.Marshal(userUsableGroups)
	if err != nil {
		common.SysLog("error marshalling user groups: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateUserUsableGroupsByJSONString(jsonStr string) error {
	userUsableGroupsMutex.Lock()
	defer userUsableGroupsMutex.Unlock()

	// Empty object wipes defaults and empties the pricing page (filter by usable groups).
	trimmed := strings.TrimSpace(jsonStr)
	if trimmed == "" || trimmed == "{}" || trimmed == "null" {
		userUsableGroups = map[string]string{
			"default": "默认分组",
			"vip":     "vip分组",
		}
		return nil
	}
	tmp := make(map[string]string)
	if err := common.Unmarshal([]byte(trimmed), &tmp); err != nil {
		return err
	}
	if len(tmp) == 0 {
		userUsableGroups = map[string]string{
			"default": "默认分组",
			"vip":     "vip分组",
		}
		return nil
	}
	userUsableGroups = tmp
	return nil
}

func GetUsableGroupDescription(groupName string) string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	if desc, ok := userUsableGroups[groupName]; ok {
		return desc
	}
	return groupName
}
