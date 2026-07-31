package setting

import (
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var groupDisplayNames = map[string]string{}
var groupDisplayNamesMutex sync.RWMutex

// GroupDisplayNames2JSONString 将分组显示名称配置序列化为 JSON。
func GroupDisplayNames2JSONString() string {
	groupDisplayNamesMutex.RLock()
	defer groupDisplayNamesMutex.RUnlock()

	jsonBytes, err := common.Marshal(groupDisplayNames)
	if err != nil {
		common.SysLog("error marshalling group display names: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

func parseGroupDisplayNames(jsonStr string) (map[string]string, error) {
	names := make(map[string]string)
	if err := common.UnmarshalJsonStr(jsonStr, &names); err != nil {
		return nil, err
	}
	if names == nil {
		names = make(map[string]string)
	}
	for identifier := range names {
		if strings.TrimSpace(identifier) == "" {
			return nil, fmt.Errorf("group identifier cannot be blank")
		}
	}
	return names, nil
}

// ValidateGroupDisplayNamesJSONString 校验分组标识和显式配置的显示名称。
func ValidateGroupDisplayNamesJSONString(jsonStr string) error {
	_, err := parseGroupDisplayNames(jsonStr)
	return err
}

// UpdateGroupDisplayNamesByJSONString 更新分组显示名称配置。
func UpdateGroupDisplayNamesByJSONString(jsonStr string) error {
	names, err := parseGroupDisplayNames(jsonStr)
	if err != nil {
		return err
	}

	groupDisplayNamesMutex.Lock()
	groupDisplayNames = names
	groupDisplayNamesMutex.Unlock()
	return nil
}

// GetGroupDisplayName 返回显示名称；旧配置未设置时回退到稳定标识。
func GetGroupDisplayName(identifier string) string {
	groupDisplayNamesMutex.RLock()
	name, ok := groupDisplayNames[identifier]
	groupDisplayNamesMutex.RUnlock()
	if ok && strings.TrimSpace(name) != "" {
		return name
	}
	return identifier
}
