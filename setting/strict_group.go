package setting

import (
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var strictGroupIsolationGroups = map[string]struct{}{}
var strictGroupIsolationGroupsMutex sync.RWMutex

func HasStrictGroupIsolationGroups() bool {
	strictGroupIsolationGroupsMutex.RLock()
	defer strictGroupIsolationGroupsMutex.RUnlock()
	return len(strictGroupIsolationGroups) > 0
}

func IsStrictGroupIsolationEnabled(group string) bool {
	strictGroupIsolationGroupsMutex.RLock()
	defer strictGroupIsolationGroupsMutex.RUnlock()
	_, ok := strictGroupIsolationGroups[strings.TrimSpace(group)]
	return ok
}

func GetStrictGroupIsolationGroups() []string {
	strictGroupIsolationGroupsMutex.RLock()
	defer strictGroupIsolationGroupsMutex.RUnlock()
	groups := make([]string, 0, len(strictGroupIsolationGroups))
	for group := range strictGroupIsolationGroups {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	return groups
}

func StrictGroupIsolationGroups2JsonString() string {
	groups := GetStrictGroupIsolationGroups()
	data, err := common.Marshal(groups)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func UpdateStrictGroupIsolationGroupsByJsonString(value string) error {
	var groups []string
	if err := common.UnmarshalJsonStr(value, &groups); err != nil {
		return err
	}
	next := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group != "" {
			next[group] = struct{}{}
		}
	}
	strictGroupIsolationGroupsMutex.Lock()
	strictGroupIsolationGroups = next
	strictGroupIsolationGroupsMutex.Unlock()
	return nil
}
