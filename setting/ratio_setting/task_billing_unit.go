package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/types"
)

const (
	TaskBillingUnitPerItem   = "per_item"
	TaskBillingUnitPerSecond = "per_second"
)

var taskBillingUnitMap = types.NewRWMap[string, string]()

func TaskBillingUnit2JSONString() string {
	units := GetTaskBillingUnitCopy()
	return taskBillingUnitsToJSONString(units)
}

func EffectiveTaskBillingUnit2JSONString() string {
	units := GetEffectiveTaskBillingUnitCopy()
	return taskBillingUnitsToJSONString(units)
}

func taskBillingUnitsToJSONString(units map[string]string) string {
	bytes, err := common.Marshal(units)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

func UpdateTaskBillingUnitByJSONString(jsonStr string) error {
	raw := make(map[string]string)
	if err := common.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return err
	}
	taskBillingUnitMap.Clear()
	for model, unit := range raw {
		normalized := NormalizeTaskBillingUnit(unit)
		if normalized == "" {
			continue
		}
		taskBillingUnitMap.Set(model, normalized)
	}
	InvalidateExposedDataCache()
	return nil
}

func GetTaskBillingUnitCopy() map[string]string {
	units := taskBillingUnitMap.ReadAll()
	for _, modelName := range constant.TaskPricePatches {
		if _, ok := units[modelName]; !ok {
			units[modelName] = TaskBillingUnitPerItem
		}
	}
	return units
}

func GetEffectiveTaskBillingUnitCopy() map[string]string {
	units := GetTaskBillingUnitCopy()
	for modelName := range modelPriceMap.ReadAll() {
		if _, ok := units[modelName]; ok {
			continue
		}
		if IsTaskPerSecondBilling(modelName) {
			units[modelName] = TaskBillingUnitPerSecond
		}
	}
	return units
}

func GetTaskBillingUnit(modelName string) (string, bool) {
	modelName = FormatMatchingModelName(modelName)
	return taskBillingUnitMap.Get(modelName)
}

func NormalizeTaskBillingUnit(unit string) string {
	switch strings.TrimSpace(strings.ToLower(unit)) {
	case TaskBillingUnitPerItem:
		return TaskBillingUnitPerItem
	case TaskBillingUnitPerSecond:
		return TaskBillingUnitPerSecond
	default:
		return ""
	}
}

func IsTaskPerItemBilling(modelName string) bool {
	if unit, ok := GetTaskBillingUnit(modelName); ok {
		return unit == TaskBillingUnitPerItem
	}
	return common.StringsContains(constant.TaskPricePatches, modelName)
}

func IsTaskPerSecondBilling(modelName string) bool {
	if unit, ok := GetTaskBillingUnit(modelName); ok {
		return unit == TaskBillingUnitPerSecond
	}
	return strings.HasPrefix(modelName, "seedance-") && !common.StringsContains(constant.TaskPricePatches, modelName)
}
