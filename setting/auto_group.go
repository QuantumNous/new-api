package setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var autoGroups = []string{
	"default",
}
var autoGroupsRWMutex sync.RWMutex

var DefaultUseAutoGroup = false

func ContainsAutoGroup(group string) bool {
	autoGroupsRWMutex.RLock()
	defer autoGroupsRWMutex.RUnlock()
	for _, autoGroup := range autoGroups {
		if autoGroup == group {
			return true
		}
	}
	return false
}

func UpdateAutoGroupsByJsonString(jsonString string) error {
	nextGroups := make([]string, 0)
	if err := common.Unmarshal([]byte(jsonString), &nextGroups); err != nil {
		return err
	}
	autoGroupsRWMutex.Lock()
	autoGroups = nextGroups
	autoGroupsRWMutex.Unlock()
	return nil
}

func AutoGroups2JsonString() string {
	autoGroupsRWMutex.RLock()
	defer autoGroupsRWMutex.RUnlock()
	jsonBytes, err := common.Marshal(autoGroups)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func GetAutoGroups() []string {
	autoGroupsRWMutex.RLock()
	defer autoGroupsRWMutex.RUnlock()
	copied := make([]string, len(autoGroups))
	copy(copied, autoGroups)
	return copied
}
