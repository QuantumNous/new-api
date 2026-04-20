package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/types"
)

type TaskConditionPriceMap map[string]map[string]map[string]float64

var taskConditionPriceMap = types.NewRWMap[string, map[string]map[string]float64]()

func TaskConditionPrice2JSONString() string {
	return taskConditionPriceMap.MarshalJSONString()
}

func UpdateTaskConditionPriceByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(taskConditionPriceMap, jsonStr, InvalidateExposedDataCache)
}

func GetTaskConditionalInputPrice(modelName, resolution string, hasVideoInput bool) (float64, bool) {
	modelMap, ok := taskConditionPriceMap.Get(FormatMatchingModelName(modelName))
	if !ok || modelMap == nil {
		return 0, false
	}

	conditionKey := "input_text_only"
	if hasVideoInput {
		conditionKey = "input_with_video"
	}

	for _, candidateResolution := range getTaskPriceResolutionCandidates(resolution) {
		if conditionMap, ok := modelMap[candidateResolution]; ok && conditionMap != nil {
			if price, ok := conditionMap[conditionKey]; ok {
				return price, true
			}
		}
	}

	return 0, false
}

func GetTaskConditionPriceCopy() TaskConditionPriceMap {
	return taskConditionPriceMap.ReadAll()
}

func getTaskPriceResolutionCandidates(resolution string) []string {
	normalized := strings.ToLower(strings.TrimSpace(resolution))
	switch normalized {
	case "480p":
		return []string{"720p"}
	case "720p", "1080p":
		return []string{normalized, "720p"}
	default:
		return []string{"720p"}
	}
}
