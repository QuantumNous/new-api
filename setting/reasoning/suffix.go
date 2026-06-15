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

func IsClaudeModel(modelName string) bool {
	target := strings.TrimSpace(modelName)
	return strings.HasPrefix(target, "claude-")
}

func IsLegacyClaudeThinkingModel(modelName string) bool {
	target := strings.TrimSpace(modelName)
	target = strings.TrimSuffix(target, "-thinking")
	if baseModel, _, ok := TrimEffortSuffix(target); ok {
		target = baseModel
	}

	legacyPrefixes := []string{
		"claude-2",
		"claude-3-",
		"claude-instant",
		"claude-opus-4-20250514",
		"claude-opus-4-1-",
		"claude-opus-4-5-",
		"claude-opus-4-6",
		"claude-sonnet-4-20250514",
		"claude-sonnet-4-5-",
		"claude-haiku-4-5-",
	}
	for _, prefix := range legacyPrefixes {
		if strings.HasPrefix(target, prefix) {
			return true
		}
	}
	return false
}
