package reasoning

import (
	"strings"

	"github.com/samber/lo"
)

var EffortSuffixes = []string{"-max", "-xhigh", "-high", "-medium", "-low", "-minimal"}

var OpenAIEffortSuffixes = []string{"-high", "-minimal", "-low", "-medium", "-none", "-xhigh"}

var DeepSeekV4EffortSuffixes = []string{"-none", "-max"}

// TrimEffortSuffix -> modelName level(low) exists
func TrimEffortSuffix(modelName string) (string, string, bool) {
	return TrimEffortSuffixWithSuffixes(modelName, EffortSuffixes)
}

func TrimEffortSuffixWithSuffixes(modelName string, suffixes []string) (string, string, bool) {
	suffix, found := lo.Find(suffixes, func(s string) bool {
		return strings.HasSuffix(modelName, s)
	})
	if !found {
		return modelName, "", false
	}
	return strings.TrimSuffix(modelName, suffix), strings.TrimPrefix(suffix, "-"), true
}

func ParseOpenAIReasoningEffortFromModelSuffix(modelName string) (string, string) {
	baseModel, effort, ok := TrimEffortSuffixWithSuffixes(modelName, OpenAIEffortSuffixes)
	if !ok {
		return "", modelName
	}
	return effort, baseModel
}

func ParseDeepSeekV4ThinkingSuffix(modelName string) (baseModel string, thinkingType string, effort string, ok bool) {
	baseModel, suffix, ok := TrimEffortSuffixWithSuffixes(modelName, DeepSeekV4EffortSuffixes)
	if !ok || !strings.HasPrefix(baseModel, "deepseek-v4-") {
		return modelName, "", "", false
	}
	switch suffix {
	case "none":
		return baseModel, "disabled", "", true
	case "max":
		return baseModel, "enabled", "max", true
	default:
		return modelName, "", "", false
	}
}
