package ratio_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/types"
)

type VideoSecondsPriceMap map[string]map[string]map[string]float64

var videoSecondsPriceMap = types.NewRWMap[string, map[string]map[string]float64]()

func VideoSecondsPrice2JSONString() string {
	return videoSecondsPriceMap.MarshalJSONString()
}

func UpdateVideoSecondsPriceByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(videoSecondsPriceMap, jsonStr, InvalidateExposedDataCache)
}

func GetVideoSecondsPrice(modelName, tier string, audioEnabled bool) (float64, bool) {
	modelMap, ok := videoSecondsPriceMap.Get(FormatMatchingModelName(modelName))
	if !ok || modelMap == nil {
		return 0, false
	}
	tierMap, ok := modelMap[strings.ToLower(strings.TrimSpace(tier))]
	if !ok || tierMap == nil {
		return 0, false
	}
	if !audioEnabled {
		if price, ok := tierMap["silent"]; ok {
			return price, true
		}
	}
	price, ok := tierMap["default"]
	return price, ok
}

func GetVideoSecondsPriceCopy() VideoSecondsPriceMap {
	return videoSecondsPriceMap.ReadAll()
}
