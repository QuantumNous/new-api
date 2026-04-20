package ratio_setting

import "github.com/QuantumNous/new-api/types"

var taskConditionRatioMap = types.NewRWMap[string, map[string]float64]()

func TaskConditionRatio2JSONString() string {
	return taskConditionRatioMap.MarshalJSONString()
}

func UpdateTaskConditionRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(taskConditionRatioMap, jsonStr, InvalidateExposedDataCache)
}

func GetTaskConditionRatio(condition, modelName string) (float64, bool) {
	modelMap, ok := taskConditionRatioMap.Get(condition)
	if !ok || modelMap == nil {
		return 0, false
	}
	ratio, ok := modelMap[FormatMatchingModelName(modelName)]
	return ratio, ok
}

func GetTaskConditionRatioCopy() map[string]map[string]float64 {
	return taskConditionRatioMap.ReadAll()
}
