package setting

import (
	"github.com/QuantumNous/new-api/common"
)

var autoGroups = []string{
	"default",
}

var DefaultUseAutoGroup = false

func ContainsAutoGroup(group string) bool {
	for _, autoGroup := range autoGroups {
		if autoGroup == group {
			return true
		}
	}
	return false
}

func UpdateAutoGroupsByJsonString(jsonString string) error {
	next := make([]string, 0)
	if err := common.UnmarshalJsonStr(jsonString, &next); err != nil {
		return err
	}
	autoGroups = next
	return nil
}

func AutoGroups2JsonString() string {
	jsonBytes, err := common.Marshal(autoGroups)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func GetAutoGroups() []string {
	return autoGroups
}
