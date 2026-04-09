package common

import "strings"

func normalizeBillingModelName(modelName string) string {
	return strings.ToLower(strings.TrimSpace(modelName))
}

func IsDurationOnlyBillingModel(modelName string) bool {
	name := normalizeBillingModelName(modelName)
	if name == "" {
		return false
	}
	if strings.HasPrefix(name, "veo") {
		return true
	}
	return strings.Contains(name, "grok-imagine") && strings.Contains(name, "video")
}

func IsResolutionOnlyBillingModel(modelName string) bool {
	name := normalizeBillingModelName(modelName)
	if name == "" {
		return false
	}
	return strings.Contains(name, "banana")
}

func FilterOtherRatiosForBillingModel(modelName string, ratios map[string]float64) map[string]float64 {
	if len(ratios) == 0 {
		return map[string]float64{}
	}

	filtered := make(map[string]float64, len(ratios))
	switch {
	case IsDurationOnlyBillingModel(modelName):
		if ratio, ok := ratios["seconds"]; ok && ratio > 0 {
			filtered["seconds"] = ratio
		}
	case IsResolutionOnlyBillingModel(modelName):
		return filtered
	default:
		for key, ratio := range ratios {
			if ratio > 0 {
				filtered[key] = ratio
			}
		}
	}

	return filtered
}
