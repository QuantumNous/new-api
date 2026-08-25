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

	// ChannelType is the configured provider type and is the source of truth.
	// ApiType only selects an adaptor implementation; multiple providers may
	// share an adaptor while exposing different native endpoint capabilities.
	switch info.ChannelType {
	case constant.ChannelTypeGemini:
		return types.RelayFormatGemini
	case constant.ChannelTypeAnthropic:
		return types.RelayFormatClaude
	case constant.ChannelTypeAws:
		if strings.Contains(strings.ToLower(info.UpstreamModelName), "nova-") {
			return types.RelayFormatOpenAI
		}
		return types.RelayFormatClaude
	case constant.ChannelTypeVertexAi:
		return vertexNativeTextFormat(info.UpstreamModelName)
	case constant.ChannelTypeCodex:
		return types.RelayFormatOpenAIResponses
	case constant.ChannelTypeAdvancedCustom, constant.ChannelTypeNewAPI, constant.ChannelTypeSub2API:
		// These channels either configure conversion per route or speak every
		// client format natively. Leave the incoming format untouched.
		return nonEmptyIncomingFormat(incoming)
	case constant.ChannelTypeMoonshot:
		if incoming == types.RelayFormatClaude {
			return types.RelayFormatClaude
		}
		return types.RelayFormatOpenAI
	case constant.ChannelTypeUnknown:
		return nativeTextFormatFromAPIType(info, incoming)
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
	switch info.ChannelType {
	case constant.ChannelTypeOpenAI,
		constant.ChannelTypeAzure,
		constant.ChannelTypeOpenRouter,
		constant.ChannelTypeXai,
		constant.ChannelTypeCodex,
		constant.ChannelTypeNewAPI,
		constant.ChannelTypeSub2API,
		constant.ChannelTypeAdvancedCustom:
		return true
	case constant.ChannelTypeUnknown:
		switch info.ApiType {
		case constant.APITypeOpenAI,
			constant.APITypeOpenRouter,
			constant.APITypeXai,
			constant.APITypeCodex,
			constant.APITypeNewAPI,
			constant.APITypeSub2API,
			constant.APITypeAdvancedCustom:
			return true
		}
	}
	return false
}

func nativeTextFormatFromAPIType(info *RelayInfo, incoming types.RelayFormat) types.RelayFormat {
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
		return nonEmptyIncomingFormat(incoming)
	case constant.APITypeMoonshot:
		if incoming == types.RelayFormatClaude {
			return types.RelayFormatClaude
		}
	}
	if incoming == types.RelayFormatOpenAIResponses && SpeaksResponsesNatively(info) {
		return types.RelayFormatOpenAIResponses
	}
	return types.RelayFormatOpenAI
}

func nonEmptyIncomingFormat(incoming types.RelayFormat) types.RelayFormat {
	if incoming == "" {
		return types.RelayFormatOpenAI
	}
	return incoming
}

func vertexNativeTextFormat(modelName string) types.RelayFormat {
	name := strings.ToLower(strings.TrimSpace(modelName))
	id := strings.ToLower(ModelIDWithoutPublisher(modelName))
	if strings.HasPrefix(id, "claude") || strings.HasPrefix(name, "claude") {
		return types.RelayFormatClaude
	}
	if strings.Contains(name, "llama") || strings.Contains(name, "-maas") {
		return types.RelayFormatOpenAI
	}
	return types.RelayFormatGemini
}
