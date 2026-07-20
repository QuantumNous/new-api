package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	FreeTrialGroup     = "Free Trial"
	FreeTrialPlanTitle = "APIMaster $50 GPT Trial"
)

func IsFreeTrialGroup(group string) bool {
	return strings.EqualFold(strings.TrimSpace(group), FreeTrialGroup)
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
