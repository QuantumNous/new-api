package setting

import (
	"encoding/json"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// Provider function variable — set by main.go after model/cache initialization.
var UserUsableGroupsCopyProvider func() map[string]string

var userUsableGroups = map[string]string{
	"default": "默认分组",
	"vip":     "vip分组",
}
var userUsableGroupsMutex sync.RWMutex

func GetUserUsableGroupsCopy() map[string]string {
	if UserUsableGroupsCopyProvider != nil {
		return UserUsableGroupsCopyProvider()
	}
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

	jsonBytes, err := json.Marshal(userUsableGroups)
	if err != nil {
		common.SysLog("error marshalling user groups: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateUserUsableGroupsByJSONString(jsonStr string) error {
	userUsableGroupsMutex.Lock()
	defer userUsableGroupsMutex.Unlock()

	userUsableGroups = make(map[string]string)
	return json.Unmarshal([]byte(jsonStr), &userUsableGroups)
}

func GetUsableGroupDescription(groupName string) string {
	if UserUsableGroupsCopyProvider != nil {
		groups := UserUsableGroupsCopyProvider()
		if desc, ok := groups[groupName]; ok {
			return desc
		}
		return groupName
	}
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	if desc, ok := userUsableGroups[groupName]; ok {
		return desc
	}
	return groupName
}

// LoadUserUsableGroupsToMemory loads usable groups into the in-memory map.
// Used when Redis is disabled so the map is populated from DB on startup.
func LoadUserUsableGroupsToMemory(m map[string]string) {
	userUsableGroupsMutex.Lock()
	defer userUsableGroupsMutex.Unlock()
	userUsableGroups = m
}
