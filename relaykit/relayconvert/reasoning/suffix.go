package reasoning

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/samber/lo"
)

var EffortSuffixes = []string{"-max", "-xhigh", "-high", "-medium", "-low", "-minimal"}

var OpenAIEffortSuffixes = []string{"-max", "-xhigh", "-high", "-medium", "-low", "-minimal", "-none"}

var DeepSeekV4EffortSuffixes = []string{"-none", "-max"}

func TrimEffortSuffixWithSuffixes(modelName string, suffixes []string) (string, string, bool) {
	suffix, found := lo.Find(suffixes, func(s string) bool {
		return strings.HasSuffix(modelName, s)
	})
	if !found {
		return modelName, "", false
	}
	return strings.TrimSuffix(modelName, suffix), strings.TrimPrefix(suffix, "-"), true
}

// ParseOpenAIReasoningEffortFromModelSuffix extracts an OpenAI effort tail
// such as -high or -none. preserveEffortTail, when non-nil, keeps real model
// IDs whose names already end in those tokens (for example qwen-max).
func ParseOpenAIReasoningEffortFromModelSuffix(modelName string, preserveEffortTail func(string) bool) (string, string) {
	if preserveEffortTail != nil && preserveEffortTail(modelName) {
		return "", modelName
	}
	baseModel, effort, ok := TrimEffortSuffixWithSuffixes(modelName, OpenAIEffortSuffixes)
	if !ok {
		return "", modelName
	}
	return effort, baseModel
}

func ParseClaudeModelSuffix(modelName string, allowThinkingAlias bool) (string, Intent, bool, error) {
	if !strings.HasPrefix(modelName, "claude-") {
		return modelName, Intent{}, false, nil
	}
	if allowThinkingAlias && hasLegacyThinkingAlias(modelName) {
		return parseProviderModelSuffix(modelName, "claude-", true, true)
	}
	if !isKnownClaudeModel(modelName) {
		return modelName, Intent{}, false, nil
	}
	return parseProviderModelSuffix(modelName, "claude-", allowThinkingAlias, true)
}

func hasLegacyThinkingAlias(modelName string) bool {
	return strings.HasSuffix(modelName, "-thinking") ||
		strings.HasSuffix(modelName, "-nothinking") ||
		strings.LastIndex(modelName, "-thinking-") >= 0
}

func isKnownClaudeModel(modelName string) bool {
	baseModel, _, _ := TrimEffortSuffixWithSuffixes(modelName, []string{"-max", "-xhigh", "-high", "-medium", "-low", "-minimal", "-none"})
	if marker := strings.LastIndex(baseModel, "-thinking-"); marker >= 0 {
		baseModel = baseModel[:marker]
	} else {
		baseModel = strings.TrimSuffix(strings.TrimSuffix(baseModel, "-thinking"), "-nothinking")
	}
	knownPrefixes := []string{
		"claude-fable-5", "claude-mythos-5", "claude-mythos-preview",
		"claude-opus-5", "claude-sonnet-5", "claude-opus-4-8",
		"claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6",
		"claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5",
		"claude-opus-4-1", "claude-opus-4-", "claude-sonnet-4-",
		"claude-3-7-sonnet",
	}
	for _, prefix := range knownPrefixes {
		if strings.HasPrefix(baseModel, prefix) {
			return true
		}
	}
	return false
}

func ParseGeminiModelSuffix(modelName string, allowThinkingAlias bool) (string, Intent, bool, error) {
	if !strings.HasPrefix(modelName, "gemini-") {
		return modelName, Intent{}, false, nil
	}
	if !isKnownGeminiModel(modelName) {
		return modelName, Intent{}, false, nil
	}
	return parseProviderModelSuffix(modelName, "gemini-", allowThinkingAlias, true)
}

// ParseKnownProviderModelSuffix extracts a canonical intent only when the
// origin identifies a provider family whose suffix vocabulary is defined by
// relaykit. Unknown OpenAI-compatible model names are deliberately untouched.
func ParseKnownProviderModelSuffix(modelName string, allowThinkingAlias bool) (string, Intent, bool, error) {
	if strings.HasPrefix(modelName, "claude-") {
		return ParseClaudeModelSuffix(modelName, allowThinkingAlias)
	}
	if strings.HasPrefix(modelName, "gemini-") {
		return ParseGeminiModelSuffix(modelName, allowThinkingAlias)
	}
	return modelName, Intent{}, false, nil
}

func isKnownGeminiModel(modelName string) bool {
	baseModel, _, _ := TrimEffortSuffixWithSuffixes(modelName, []string{"-max", "-xhigh", "-high", "-medium", "-low", "-minimal", "-none"})
	if marker := strings.LastIndex(baseModel, "-thinking-"); marker >= 0 {
		baseModel = baseModel[:marker]
	} else {
		baseModel = strings.TrimSuffix(strings.TrimSuffix(baseModel, "-thinking"), "-nothinking")
	}
	return geminiCapabilitiesFor(baseModel).kind != geminiThinkingUnknown
}

func TrimGeminiThinkingSuffix(modelName string) (string, bool) {
	baseModel, _, ok, err := ParseGeminiModelSuffix(modelName, true)
	return baseModel, ok && err == nil
}

func parseProviderModelSuffix(modelName string, requiredPrefix string, allowThinkingAlias bool, includeThoughts bool) (string, Intent, bool, error) {
	if allowThinkingAlias {
		if marker := strings.LastIndex(modelName, "-thinking-"); marker >= 0 {
			baseModel := modelName[:marker]
			if !strings.HasPrefix(baseModel, requiredPrefix) {
				return modelName, Intent{}, false, nil
			}
			budget, err := strconv.Atoi(modelName[marker+len("-thinking-"):])
			if err != nil {
				return modelName, Intent{}, false, fmt.Errorf("invalid thinking budget suffix on model %q: %w", modelName, err)
			}
			intent := Intent{BudgetTokens: &budget, Source: SourceSuffix, BudgetSource: SourceSuffix}
			if includeThoughts {
				value := true
				intent.IncludeThoughts = &value
			}
			return baseModel, intent, true, nil
		}
		if strings.HasSuffix(modelName, "-nothinking") {
			baseModel := strings.TrimSuffix(modelName, "-nothinking")
			return baseModel, Intent{Mode: ModeDisabled, Effort: EffortNone, Source: SourceSuffix}, true, nil
		}
		if strings.HasSuffix(modelName, "-thinking") {
			baseModel := strings.TrimSuffix(modelName, "-thinking")
			intent := Intent{Mode: ModeEnabled, Source: SourceSuffix}
			if includeThoughts {
				value := true
				intent.IncludeThoughts = &value
			}
			return baseModel, intent, true, nil
		}
	}

	suffixes := []string{"-max", "-xhigh", "-high", "-medium", "-low", "-minimal", "-none"}
	baseModel, rawEffort, ok := TrimEffortSuffixWithSuffixes(modelName, suffixes)
	if !ok || !strings.HasPrefix(baseModel, requiredPrefix) {
		return modelName, Intent{}, false, nil
	}
	effort, err := ParseEffort(rawEffort)
	if err != nil {
		return modelName, Intent{}, false, err
	}
	intent := Intent{Effort: effort, Mode: ModeEnabled, Source: SourceSuffix}
	if effort == EffortNone {
		intent.Mode = ModeDisabled
	} else if includeThoughts {
		value := true
		intent.IncludeThoughts = &value
	}
	return baseModel, intent, true, nil
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
