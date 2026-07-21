package ratio_setting

import (
	"fmt"
	"math"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

var imageResolutionPriceMap = types.NewRWMap[string, map[string]float64]()
var imageResolutionPattern = regexp.MustCompile(`^[1-9][0-9]*(?:K)?$`)

// NormalizeImageResolution normalizes public image resolution tiers while
// keeping the setting extensible for future positive pixel and K tiers.
func NormalizeImageResolution(resolution string) (string, error) {
	resolution = strings.ToUpper(strings.TrimSpace(resolution))
	if resolution == "" {
		return "", fmt.Errorf("image resolution is required")
	}
	if !imageResolutionPattern.MatchString(resolution) {
		return "", fmt.Errorf("invalid image resolution %q", resolution)
	}
	return resolution, nil
}

func ImageResolutionPrice2JSONString() string {
	return imageResolutionPriceMap.MarshalJSONString()
}

func parseImageResolutionPriceJSONString(jsonStr string) (map[string]map[string]float64, string, error) {
	if strings.TrimSpace(jsonStr) == "" {
		jsonStr = "{}"
	}

	var raw map[string]map[string]float64
	if err := common.UnmarshalJsonStr(jsonStr, &raw); err != nil {
		return nil, "", err
	}
	normalized := make(map[string]map[string]float64, len(raw))
	for modelName, prices := range raw {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			return nil, "", fmt.Errorf("image resolution price contains an empty model name")
		}
		if _, exists := normalized[modelName]; exists {
			return nil, "", fmt.Errorf("image resolution price contains duplicate model %s after normalization", modelName)
		}
		modelPrices := make(map[string]float64, len(prices))
		for resolution, price := range prices {
			normalizedResolution, err := NormalizeImageResolution(resolution)
			if err != nil {
				return nil, "", fmt.Errorf("model %s: %w", modelName, err)
			}
			if price < 0 || math.IsNaN(price) || math.IsInf(price, 0) {
				return nil, "", fmt.Errorf("model %s resolution %s has invalid price", modelName, normalizedResolution)
			}
			if _, exists := modelPrices[normalizedResolution]; exists {
				return nil, "", fmt.Errorf("model %s contains duplicate resolution %s", modelName, normalizedResolution)
			}
			modelPrices[normalizedResolution] = price
		}
		normalized[modelName] = modelPrices
	}

	encoded, err := common.Marshal(normalized)
	if err != nil {
		return nil, "", err
	}
	return normalized, string(encoded), nil
}

// ValidateImageResolutionPriceJSONString validates without changing the
// process-wide price map. Callers can use it before persisting an option.
func ValidateImageResolutionPriceJSONString(jsonStr string) error {
	_, _, err := parseImageResolutionPriceJSONString(jsonStr)
	return err
}

func RemoveImageResolutionPriceModelsJSONString(jsonStr string, modelNames []string) (string, bool, error) {
	prices, encoded, err := parseImageResolutionPriceJSONString(jsonStr)
	if err != nil {
		return "", false, err
	}
	removeSet := make(map[string]struct{}, len(modelNames))
	for _, modelName := range modelNames {
		if modelName = strings.TrimSpace(modelName); modelName != "" {
			removeSet[modelName] = struct{}{}
		}
	}
	changed := false
	for modelName := range prices {
		if _, ok := removeSet[modelName]; !ok {
			continue
		}
		delete(prices, modelName)
		changed = true
	}
	if !changed {
		return encoded, false, nil
	}
	next, err := common.Marshal(prices)
	if err != nil {
		return "", false, err
	}
	return string(next), true, nil
}

func UpdateImageResolutionPriceByJSONString(jsonStr string) error {
	_, encoded, err := parseImageResolutionPriceJSONString(jsonStr)
	if err != nil {
		return err
	}
	return types.LoadFromJsonStringWithCallback(imageResolutionPriceMap, string(encoded), InvalidateExposedDataCache)
}

func GetImageResolutionPrice(modelName, resolution string) (float64, bool) {
	normalizedResolution, err := NormalizeImageResolution(resolution)
	if err != nil {
		return 0, false
	}
	prices, ok := imageResolutionPriceMap.Get(FormatMatchingModelName(strings.TrimSpace(modelName)))
	if !ok {
		return 0, false
	}
	price, ok := prices[normalizedResolution]
	return price, ok
}

func GetImageResolutionPrices(modelName string) map[string]float64 {
	prices, ok := imageResolutionPriceMap.Get(FormatMatchingModelName(strings.TrimSpace(modelName)))
	if !ok {
		return nil
	}
	copyPrices := make(map[string]float64, len(prices))
	for resolution, price := range prices {
		copyPrices[resolution] = price
	}
	return copyPrices
}

func GetImageResolutionPriceCopy() map[string]map[string]float64 {
	allPrices := imageResolutionPriceMap.ReadAll()
	copyPrices := make(map[string]map[string]float64, len(allPrices))
	for modelName, prices := range allPrices {
		modelPrices := make(map[string]float64, len(prices))
		for resolution, price := range prices {
			modelPrices[resolution] = price
		}
		copyPrices[modelName] = modelPrices
	}
	return copyPrices
}
