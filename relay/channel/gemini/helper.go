package gemini

import (
	"strings"
)

func IsModelSupportThoughtsSummary(modelName string) bool {
	for _, supportedModel := range ModelsWithThoughtsSummarySupport {
		if strings.HasPrefix(modelName, supportedModel) {
			return true
		}
	}

	return false
}

func IsModelWithMinimumThinkingBudgetLimits(modelName string) bool {
	for _, specialModel := range ModelsWithMinimumThinkingBudgetLimits {
		if strings.HasPrefix(modelName, specialModel) {
			return true
		}
	}

	return false
}
