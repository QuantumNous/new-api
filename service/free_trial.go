package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	FreeTrialGroup       = "Subscription"
	FreeTrialPlanTitle   = "APIMaster $50 GPT Trial"
	legacyFreeTrialGroup = "Free Trial"
)

func IsFreeTrialGroup(group string) bool {
	normalized := strings.TrimSpace(group)
	return strings.EqualFold(normalized, FreeTrialGroup) ||
		strings.EqualFold(normalized, legacyFreeTrialGroup)
}

func IsFreeTrialEligibleModel(modelName string) bool {
	lower := strings.ToLower(strings.TrimSpace(modelName))
	if lower == "" {
		return false
	}
	if common.IsImageGenerationModel(lower) {
		return false
	}
	if !common.IsOpenAITextModel(lower) {
		return false
	}
	return strings.Contains(lower, "gpt-") || strings.HasPrefix(lower, "chatgpt")
}

func FilterFreeTrialModels(models []string) []string {
	if len(models) == 0 {
		return []string{}
	}
	filtered := make([]string, 0, len(models))
	seen := make(map[string]struct{}, len(models))
	for _, modelName := range models {
		if !IsFreeTrialEligibleModel(modelName) {
			continue
		}
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}
		filtered = append(filtered, modelName)
	}
	return filtered
}
