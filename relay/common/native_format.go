package common

import (
	"strings"

	hostcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// NativeTextFormat is the wire format the selected channel speaks for text
// generation. Incoming requests in a different format are converted through
// the IR hub (From → IR → To).
//
// OpenAI Responses is special:
//   - Channels that only speak Responses (Codex) always use it as native.
//   - Channels that speak both Chat and Responses keep Chat as native.
//     Chat→Responses happens only when the admin
//     chat_completions_to_responses_policy matches the model — that upgrade
//     is applied by BuildTextPlan, not by rewriting RelayMode.
//   - Incoming Responses to a Chat-only channel/model convert Responses→Chat.
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
	case constant.ChannelTypeMoonshot, constant.ChannelTypeMiniMax:
		if incoming == types.RelayFormatClaude {
			return types.RelayFormatClaude
		}
		return types.RelayFormatOpenAI
	case constant.ChannelTypeAli:
		if incoming == types.RelayFormatClaude && AliSpeaksClaude(info.UpstreamModelName) {
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

// SpeaksResponsesNatively reports whether the selected channel/model can
// forward an OpenAI Responses request without converting it to Chat
// Completions. Generic "OpenAI" channels are frequently used for
// OpenAI-compatible providers that expose only /v1/chat/completions, so their
// model family must participate in the capability decision.
func SpeaksResponsesNatively(info *RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	switch info.ChannelType {
	case constant.ChannelTypeOpenAI:
		return openAICompatibleModelSpeaksResponses(info)
	case constant.ChannelTypeAzure,
		constant.ChannelTypeOpenRouter,
		constant.ChannelTypeXai,
		constant.ChannelTypeCodex,
		constant.ChannelTypeNewAPI,
		constant.ChannelTypeSub2API,
		constant.ChannelTypeAdvancedCustom:
		return true
	case constant.ChannelTypeUnknown:
		switch info.ApiType {
		case constant.APITypeOpenAI:
			return openAICompatibleModelSpeaksResponses(info)
		case constant.APITypeOpenRouter,
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

func openAICompatibleModelSpeaksResponses(info *RelayInfo) bool {
	if info == nil {
		return false
	}
	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(info.OriginModelName)
	}
	if modelName == "" {
		// Preserve the historical channel-level behavior for callers that have
		// not resolved a model yet. Production text routing always has one.
		return true
	}
	return hostcommon.IsOpenAITextModel(modelName) ||
		hostcommon.IsOpenAIResponseOnlyModel(modelName) ||
		hostcommon.IsOpenAIChatAndResponsesModel(modelName)
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
	case constant.APITypeAli:
		if incoming == types.RelayFormatClaude && AliSpeaksClaude(info.UpstreamModelName) {
			return types.RelayFormatClaude
		}
		return types.RelayFormatOpenAI
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
