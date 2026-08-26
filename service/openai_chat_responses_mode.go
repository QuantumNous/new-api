package service

import (
	"regexp"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

// Chat/Responses protocol selection is host routing logic (it decides whether
// to convert and reads host settings), so it lives here, not in relayconvert.

var chatResponsesRegexCache sync.Map // map[string]*regexp.Regexp

func matchAnyModelPattern(patterns []string, model string) bool {
	if len(patterns) == 0 || model == "" {
		return false
	}
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		re, ok := chatResponsesRegexCache.Load(pattern)
		if !ok {
			compiled, err := regexp.Compile(pattern)
			if err != nil {
				// Treat invalid patterns as non-matching to avoid breaking runtime traffic.
				continue
			}
			re = compiled
			chatResponsesRegexCache.Store(pattern, re)
		}
		if re.(*regexp.Regexp).MatchString(model) {
			return true
		}
	}
	return false
}

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	if !policy.IsChannelEnabled(channelID, channelType) {
		return false
	}
	return matchAnyModelPattern(policy.ModelPatterns, model)
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return ShouldChatCompletionsUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		model,
	)
}

// ShouldOpenAIChannelUseResponsesPolicy selects the upstream wire protocol for
// a configured OpenAI channel. Responses-only models are protected regardless
// of administrator preference. Selected custom-policy channels use the regex
// list as the complete source of truth; other channels use automatic routing,
// where mapped gpt-* models prefer Responses and all other models prefer Chat.
func ShouldOpenAIChannelUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, upstreamModel string) bool {
	upstreamModel = strings.TrimSpace(upstreamModel)
	if common.IsOpenAIResponseOnlyModel(upstreamModel) {
		return true
	}
	if policy.IsChannelEnabled(channelID, channelType) {
		return matchAnyModelPattern(policy.ModelPatterns, upstreamModel)
	}
	return common.IsOpenAIGPTModel(upstreamModel)
}

func ShouldOpenAIChannelUseResponsesGlobal(channelID int, channelType int, upstreamModel string) bool {
	return ShouldOpenAIChannelUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		upstreamModel,
	)
}
