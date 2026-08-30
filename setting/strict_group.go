package setting

import (
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/group_state"
)

var strictGroupIsolationGroups = map[string]struct{}{}
var strictGroupIsolationGroupsMutex sync.RWMutex

// HasStrictGroupIsolationGroups reports whether strict isolation is enabled
// for at least one user group.
func HasStrictGroupIsolationGroups() bool {
	return group_state.Read(func() bool {
		strictGroupIsolationGroupsMutex.RLock()
		defer strictGroupIsolationGroupsMutex.RUnlock()
		return len(strictGroupIsolationGroups) > 0
	})
}

// IsStrictGroupIsolationEnabled reports whether group is strictly isolated.
func IsStrictGroupIsolationEnabled(group string) bool {
	return group_state.Read(func() bool {
		strictGroupIsolationGroupsMutex.RLock()
		defer strictGroupIsolationGroupsMutex.RUnlock()
		_, ok := strictGroupIsolationGroups[strings.TrimSpace(group)]
		return ok
	})
}

// GetStrictGroupIsolationGroups returns a sorted copy of the isolated groups.
func GetStrictGroupIsolationGroups() []string {
	return group_state.Read(getStrictGroupIsolationGroups)
}

func getStrictGroupIsolationGroups() []string {
	strictGroupIsolationGroupsMutex.RLock()
	defer strictGroupIsolationGroupsMutex.RUnlock()
	groups := make([]string, 0, len(strictGroupIsolationGroups))
	for group := range strictGroupIsolationGroups {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	return groups
}

// StrictGroupIsolationGroups2JsonString serializes isolated groups as JSON.
func StrictGroupIsolationGroups2JsonString() string {
	return group_state.Read(strictGroupIsolationGroups2JsonString)
}

func strictGroupIsolationGroups2JsonString() string {
	groups := getStrictGroupIsolationGroups()
	data, err := common.Marshal(groups)
	if err != nil {
		return "[]"
	}
	return string(data)
}

// UpdateStrictGroupIsolationGroupsByJsonString validates, normalizes, and
// publishes the isolated groups as a standalone snapshot update.
func UpdateStrictGroupIsolationGroupsByJsonString(value string) error {
	return group_state.Write(func() error {
		return ReplaceStrictGroupIsolationGroupsByJsonString(value)
	})
}

// ReplaceStrictGroupIsolationGroupsByJsonString replaces the strict groups
// inside an existing group_state.Write callback.
func ReplaceStrictGroupIsolationGroupsByJsonString(value string) error {
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
