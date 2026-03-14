package service

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

// ResolveRequestEndpointType maps a request path + relay mode to a configurable endpoint type.
// Empty return means "unknown/unrestricted", and channel filtering should be skipped.
func ResolveRequestEndpointType(requestPath string, relayMode int) constant.EndpointType {
	if strings.HasPrefix(requestPath, "/v1/messages") {
		return constant.EndpointTypeAnthropic
	}
	if relayMode == relayconstant.RelayModeUnknown {
		relayMode = relayconstant.Path2RelayMode(requestPath)
	}

	switch relayMode {
	case relayconstant.RelayModeResponses:
		return constant.EndpointTypeOpenAIResponse
	case relayconstant.RelayModeResponsesCompact:
		return constant.EndpointTypeOpenAIResponseCompact
	case relayconstant.RelayModeEmbeddings:
		return constant.EndpointTypeEmbeddings
	case relayconstant.RelayModeRerank:
		return constant.EndpointTypeJinaRerank
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits, relayconstant.RelayModeEdits:
		return constant.EndpointTypeImageGeneration
	case relayconstant.RelayModeGemini:
		return constant.EndpointTypeGemini
	case relayconstant.RelayModeVideoSubmit, relayconstant.RelayModeVideoFetchByID:
		return constant.EndpointTypeOpenAIVideo
	case relayconstant.RelayModeChatCompletions,
		relayconstant.RelayModeCompletions,
		relayconstant.RelayModeModerations,
		relayconstant.RelayModeAudioSpeech,
		relayconstant.RelayModeAudioTranslation,
		relayconstant.RelayModeAudioTranscription,
		relayconstant.RelayModeRealtime:
		return constant.EndpointTypeOpenAI
	default:
		return ""
	}
}
