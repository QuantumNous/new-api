package setting

import (
	"fmt"
	"slices"
	"strconv"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

const DefaultMaxTokenAutoGroups = 5

var autoGroups = []string{
	"default",
}

var DefaultUseAutoGroup = false

var maxTokenAutoGroups atomic.Int64

func init() {
	maxTokenAutoGroups.Store(DefaultMaxTokenAutoGroups)
}

func ContainsAutoGroup(group string) bool {
	return slices.Contains(autoGroups, group)
}

// ParseAutoGroups validates the complete array before any settings are changed.
func ParseAutoGroups(jsonString string) ([]string, error) {
	var values []any
	if err := common.UnmarshalJsonStr(jsonString, &values); err != nil || values == nil {
		return nil, common.NewMessage("Expected a JSON array of group identifiers")
	}
	groups := make([]string, len(values))
	for i, value := range values {
		group, ok := value.(string)
		if !ok {
			return nil, common.NewMessage("Expected a JSON array of group identifiers")
		}
		groups[i] = group
	}
	return groups, nil
}

func UpdateAutoGroupsByJsonString(jsonString string) error {
	groups, err := ParseAutoGroups(jsonString)
	if err != nil {
		return err
	}
	autoGroups = groups
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

func GetMaxTokenAutoGroups() int {
	return int(maxTokenAutoGroups.Load())
}

func ValidateMaxTokenAutoGroups(value string) error {
	maxCount, err := strconv.Atoi(value)
	if err != nil || maxCount <= 0 {
		return fmt.Errorf("MaxTokenAutoGroups must be a positive integer")
	}
	return nil
}

func UpdateMaxTokenAutoGroups(value string) error {
	if err := ValidateMaxTokenAutoGroups(value); err != nil {
		return err
	}
	maxCount, _ := strconv.Atoi(value)
	maxTokenAutoGroups.Store(int64(maxCount))
	return nil
}
