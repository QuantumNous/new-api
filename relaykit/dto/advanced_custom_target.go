package dto

import (
	"strings"

	"github.com/QuantumNous/new-api/relaykit/types"
)

const (
	AdvancedCustomTargetNative    = "native"
	AdvancedCustomTargetChat      = "chat"
	AdvancedCustomTargetResponses = "responses"
	AdvancedCustomTargetClaude    = "claude"
	AdvancedCustomTargetGemini    = "gemini"
)

func IsAdvancedCustomTargetAllowed(target string) bool {
	switch strings.ToLower(strings.TrimSpace(target)) {
	case AdvancedCustomTargetNative,
		AdvancedCustomTargetChat,
		AdvancedCustomTargetResponses,
		AdvancedCustomTargetClaude,
		AdvancedCustomTargetGemini:
		return true
	default:
		return false
	}
}

func AdvancedCustomTargetFromConverter(converter string) string {
	switch strings.TrimSpace(converter) {
	case "", advancedCustomConverterNone:
		return AdvancedCustomTargetNative
	case advancedCustomConverterClaudeMessagesToOpenAIChat,
		advancedCustomConverterOpenAIResponsesToOpenAIChat,
		advancedCustomConverterGeminiContentToOpenAIChat:
		return AdvancedCustomTargetChat
	case advancedCustomConverterOpenAIChatToOpenAIResponses:
		return AdvancedCustomTargetResponses
	case advancedCustomConverterOpenAIChatToClaudeMessages:
		return AdvancedCustomTargetClaude
	case advancedCustomConverterOpenAIChatToGeminiContent,
		advancedCustomConverterOpenAIResponsesToGemini:
		return AdvancedCustomTargetGemini
	default:
		return AdvancedCustomTargetNative
	}
}

func (r AdvancedCustomRoute) ResolvedTarget() string {
	if target := strings.ToLower(strings.TrimSpace(r.Target)); target != "" {
		return target
	}
	return AdvancedCustomTargetFromConverter(r.Converter)
}

func AdvancedCustomTargetFormat(target string, client types.RelayFormat) types.RelayFormat {
	switch strings.ToLower(strings.TrimSpace(target)) {
	case AdvancedCustomTargetChat:
		return types.RelayFormatOpenAI
	case AdvancedCustomTargetResponses:
		return types.RelayFormatOpenAIResponses
	case AdvancedCustomTargetClaude:
		return types.RelayFormatClaude
	case AdvancedCustomTargetGemini:
		return types.RelayFormatGemini
	default:
		if client == "" {
			return types.RelayFormatOpenAI
		}
		return client
	}
}

func IsAdvancedCustomTextIncomingPath(incomingPath string) bool {
	path := strings.TrimSpace(incomingPath)
	switch path {
	case advancedCustomEndpointPathOpenAIChat,
		advancedCustomEndpointPathOpenAIResponses,
		advancedCustomEndpointPathClaudeMessages:
		return true
	}
	return strings.Contains(path, ":generateContent") || strings.Contains(path, ":streamGenerateContent")
}
