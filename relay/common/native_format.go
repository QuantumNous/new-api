package common

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// NativeTextFormat is the wire format the selected channel speaks for text
// generation. Incoming requests in a different format are converted through
// the Chat Completions hub (the six first-class converters).
//
// OpenAI Responses is special:
//   - Channels that only speak Responses (Codex) always use it as native.
//   - Channels that speak both Chat and Responses (OpenAI / Azure / ...) keep
//     Chat as native. Chat→Responses happens only when the admin
//     chat_completions_to_responses_policy matches the model — that upgrade
//     is applied by the Chat / Claude / Gemini helpers, not here.
//   - Incoming Responses to a Chat-only channel convert Responses→Chat.
func NativeTextFormat(info *RelayInfo, incoming types.RelayFormat) types.RelayFormat {
	if info == nil || info.ChannelMeta == nil {
		if incoming == "" {
			return types.RelayFormatOpenAI
		}
		return incoming
	}

	switch info.ApiType {
	case constant.APITypeGemini:
		return types.RelayFormatGemini
	case constant.APITypeAnthropic:
		return types.RelayFormatClaude
	case constant.APITypeAws:
		if strings.Contains(strings.ToLower(info.UpstreamModelName), "nova-") {
			return types.RelayFormatOpenAI
		}
		return types.RelayFormatClaude
	case constant.APITypeVertexAi:
		return vertexNativeTextFormat(info.UpstreamModelName)
	case constant.APITypeCodex:
		return types.RelayFormatOpenAIResponses
	case constant.APITypeAdvancedCustom, constant.APITypeNewAPI, constant.APITypeSub2API:
		// These channels either configure conversion per route or speak every
		// client format natively. Leave the incoming format untouched.
		if incoming == "" {
			return types.RelayFormatOpenAI
		}
		return incoming
	case constant.APITypeMoonshot:
		if incoming == types.RelayFormatClaude {
			return types.RelayFormatClaude
		}
		return types.RelayFormatOpenAI
	default:
		if incoming == types.RelayFormatOpenAIResponses && SpeaksResponsesNatively(info) {
			return types.RelayFormatOpenAIResponses
		}
		return types.RelayFormatOpenAI
	}
}

// SpeaksResponsesNatively reports whether the channel can forward an OpenAI
// Responses request without converting it to Chat Completions.
func SpeaksResponsesNatively(info *RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	switch info.ApiType {
	case constant.APITypeOpenAI,
		constant.APITypeOpenRouter,
		constant.APITypeCodex,
		constant.APITypeNewAPI,
		constant.APITypeSub2API,
		constant.APITypeAdvancedCustom:
		return true
	default:
		return false
	}
}

func vertexNativeTextFormat(modelName string) types.RelayFormat {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if strings.HasPrefix(name, "claude") {
		return types.RelayFormatClaude
	}
	if strings.Contains(name, "llama") || strings.Contains(name, "-maas") {
		return types.RelayFormatOpenAI
	}
	return types.RelayFormatGemini
}
