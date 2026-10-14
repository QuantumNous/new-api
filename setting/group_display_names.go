package setting

import (
	"fmt"
	"maps"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var groupDisplayNames = map[string]string{}
var groupDisplayNamesMutex sync.RWMutex

func ParseGroupDisplayNames(value string) (map[string]string, error) {
	var names map[string]string
	if err := common.UnmarshalJsonStr(value, &names); err != nil {
		return nil, err
	}
	if names == nil {
		return nil, fmt.Errorf("group display names must be a JSON object")
	}
	for key, name := range names {
		if strings.TrimSpace(key) == "" || strings.TrimSpace(key) != key {
			return nil, fmt.Errorf("invalid group identifier")
		}
		name = strings.TrimSpace(name)
		if name == "" {
			delete(names, key)
		} else {
			names[key] = name
		}
	}
	return names, nil
}

func UpdateGroupDisplayNames(value string) error {
	names, err := ParseGroupDisplayNames(value)
	if err != nil {
		return err
	}
	groupDisplayNamesMutex.Lock()
	defer groupDisplayNamesMutex.Unlock()
	groupDisplayNames = names
	return nil
}

func GetGroupDisplayNames() map[string]string {
	groupDisplayNamesMutex.RLock()
	defer groupDisplayNamesMutex.RUnlock()
	return maps.Clone(groupDisplayNames)
}

func GroupDisplayNamesJSON() string {
	data, _ := common.Marshal(GetGroupDisplayNames())
	return string(data)
}
