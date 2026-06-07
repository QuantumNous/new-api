package customendpoint

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

type routeKind string

const (
	routeKindOpenAIChatCompletions       routeKind = "openai_chat_completions"
	routeKindOpenAICompletions           routeKind = "openai_completions"
	routeKindOpenAIResponses             routeKind = "openai_responses"
	routeKindOpenAIResponsesCompact      routeKind = "openai_responses_compact"
	routeKindAnthropicMessages           routeKind = "anthropic_messages"
	routeKindGeminiGenerateContent       routeKind = "gemini_generate_content"
	routeKindGeminiStreamGenerateContent routeKind = "gemini_stream_generate_content"
	routeKindGeminiEmbedContent          routeKind = "gemini_embed_content"
	routeKindGeminiBatchEmbedContents    routeKind = "gemini_batch_embed_contents"
	routeKindOpenAIEmbeddings            routeKind = "openai_embeddings"
	routeKindOpenAIImagesGenerations     routeKind = "openai_images_generations"
	routeKindOpenAIImagesEdits           routeKind = "openai_images_edits"
	routeKindOpenAIAudioSpeech           routeKind = "openai_audio_speech"
	routeKindOpenAIAudioTranscriptions   routeKind = "openai_audio_transcriptions"
	routeKindOpenAIAudioTranslations     routeKind = "openai_audio_translations"
	routeKindOpenAIModerations           routeKind = "openai_moderations"
	routeKindRerank                      routeKind = "rerank"
)

type routeTarget struct {
	candidates []string
	kind       routeKind
}

const (
	geminiV1BetaModelsPrefix = "/v1beta/models/"
	geminiV1ModelsPrefix     = "/v1/models/"
)

type geminiRouteSuffix struct {
	suffix string
	kind   routeKind
}

var allowedTransformersByRouteKind = map[routeKind]map[dto.CustomEndpointTransformer]struct{}{
	routeKindOpenAIChatCompletions: {
		dto.CustomEndpointTransformerOpenAIChatCompletions: {},
		dto.CustomEndpointTransformerClaudeMessages:        {},
		dto.CustomEndpointTransformerGeminiGenerateContent: {},
		dto.CustomEndpointTransformerOpenAIResponses:       {},
	},
	routeKindOpenAICompletions: {
		dto.CustomEndpointTransformerOpenAICompletions: {},
	},
	routeKindOpenAIModerations: {
		dto.CustomEndpointTransformerOpenAIModerations: {},
	},
	routeKindOpenAIResponses: {
		dto.CustomEndpointTransformerOpenAIResponses: {},
	},
	routeKindOpenAIResponsesCompact: {
		dto.CustomEndpointTransformerOpenAIResponsesCompact: {},
	},
	routeKindAnthropicMessages: {
		dto.CustomEndpointTransformerClaudeMessages:        {},
		dto.CustomEndpointTransformerOpenAIChatCompletions: {},
		dto.CustomEndpointTransformerGeminiGenerateContent: {},
	},
	routeKindGeminiGenerateContent: {
		dto.CustomEndpointTransformerGeminiGenerateContent: {},
		dto.CustomEndpointTransformerOpenAIChatCompletions: {},
	},
	routeKindGeminiStreamGenerateContent: {
		dto.CustomEndpointTransformerGeminiGenerateContent: {},
		dto.CustomEndpointTransformerOpenAIChatCompletions: {},
	},
	routeKindOpenAIEmbeddings: {
		dto.CustomEndpointTransformerOpenAIEmbeddings: {},
		dto.CustomEndpointTransformerGeminiEmbeddings: {},
	},
	routeKindGeminiEmbedContent: {
		dto.CustomEndpointTransformerGeminiEmbeddings: {},
	},
	routeKindGeminiBatchEmbedContents: {
		dto.CustomEndpointTransformerGeminiEmbeddings: {},
	},
	routeKindOpenAIImagesGenerations: {
		dto.CustomEndpointTransformerOpenAIImages: {},
		dto.CustomEndpointTransformerGeminiImage:  {},
	},
	routeKindOpenAIImagesEdits: {
		dto.CustomEndpointTransformerOpenAIImages: {},
	},
	routeKindOpenAIAudioSpeech: {
		dto.CustomEndpointTransformerOpenAIAudio: {},
	},
	routeKindOpenAIAudioTranscriptions: {
		dto.CustomEndpointTransformerOpenAIAudio: {},
	},
	routeKindOpenAIAudioTranslations: {
		dto.CustomEndpointTransformerOpenAIAudio: {},
	},
	routeKindRerank: {
		dto.CustomEndpointTransformerJinaRerank:   {},
		dto.CustomEndpointTransformerCohereRerank: {},
	},
}

var geminiRouteSuffixes = []geminiRouteSuffix{
	{suffix: ":batchEmbedContents", kind: routeKindGeminiBatchEmbedContents},
	{suffix: ":embedContent", kind: routeKindGeminiEmbedContent},
	{suffix: ":streamGenerateContent", kind: routeKindGeminiStreamGenerateContent},
	{suffix: ":generateContent", kind: routeKindGeminiGenerateContent},
}

func resolveRoute(info *relaycommon.RelayInfo) (string, routeKind, dto.CustomEndpointRoute, error) {
	target, err := routeTargetFromRelayInfo(info)
	if err != nil {
		return "", "", dto.CustomEndpointRoute{}, err
	}
	for _, candidate := range target.candidates {
		route, ok := info.ChannelSetting.CustomEndpoint.Routes[candidate]
		if ok {
			return candidate, target.kind, route, nil
		}
	}
	return "", "", dto.CustomEndpointRoute{}, fmt.Errorf("custom endpoint route %s is not configured", strings.Join(target.candidates, " or "))
}

func routeTargetFromRelayInfo(info *relaycommon.RelayInfo) (routeTarget, error) {
	if info == nil {
		return routeTarget{}, errors.New("missing relay info")
	}
	requestPath := requestPathOnly(info.RequestURLPath)
	if info.RelayFormat == types.RelayFormatClaude {
		return newRouteTarget(routeKindAnthropicMessages, requestPath, "/v1/messages"), nil
	}
	if info.RelayFormat == types.RelayFormatGemini {
		return geminiRouteTarget(info.RequestURLPath, requestPath), nil
	}

	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		return newRouteTarget(routeKindOpenAIChatCompletions, requestPath, "/v1/chat/completions"), nil
	case relayconstant.RelayModeCompletions:
		return newRouteTarget(routeKindOpenAICompletions, requestPath, "/v1/completions"), nil
	case relayconstant.RelayModeResponses:
		return newRouteTarget(routeKindOpenAIResponses, requestPath, "/v1/responses"), nil
	case relayconstant.RelayModeResponsesCompact:
		return newRouteTarget(routeKindOpenAIResponsesCompact, requestPath, "/v1/responses/compact"), nil
	case relayconstant.RelayModeEmbeddings:
		return newRouteTarget(routeKindOpenAIEmbeddings, requestPath, "/v1/embeddings"), nil
	case relayconstant.RelayModeImagesGenerations:
		return newRouteTarget(routeKindOpenAIImagesGenerations, requestPath, "/v1/images/generations"), nil
	case relayconstant.RelayModeImagesEdits:
		return newRouteTarget(routeKindOpenAIImagesEdits, requestPath, "/v1/images/edits"), nil
	case relayconstant.RelayModeAudioSpeech:
		return newRouteTarget(routeKindOpenAIAudioSpeech, requestPath, "/v1/audio/speech"), nil
	case relayconstant.RelayModeAudioTranscription:
		return newRouteTarget(routeKindOpenAIAudioTranscriptions, requestPath, "/v1/audio/transcriptions"), nil
	case relayconstant.RelayModeAudioTranslation:
		return newRouteTarget(routeKindOpenAIAudioTranslations, requestPath, "/v1/audio/translations"), nil
	case relayconstant.RelayModeModerations:
		return newRouteTarget(routeKindOpenAIModerations, requestPath, "/v1/moderations"), nil
	case relayconstant.RelayModeRerank:
		return newRouteTarget(routeKindRerank, requestPath, "/v1/rerank", "/rerank"), nil
	default:
		return routeTarget{}, fmt.Errorf("unsupported relay mode for custom endpoint: %d", info.RelayMode)
	}
}

func geminiRouteTarget(requestURLPath string, requestPath string) routeTarget {
	if kind, ok := geminiRouteKindFromPath(requestPath); ok {
		return newRouteTarget(kind, requestPath, normalizeGeminiRoutePath(requestPath))
	}
	if strings.Contains(requestURLPath, ":batchEmbedContents") {
		return newRouteTarget(routeKindGeminiBatchEmbedContents, requestPath, "/v1beta/models/{model}:batchEmbedContents")
	}
	if strings.Contains(requestURLPath, ":streamGenerateContent") {
		return newRouteTarget(routeKindGeminiStreamGenerateContent, requestPath, "/v1beta/models/{model}:streamGenerateContent")
	}
	if strings.Contains(requestURLPath, ":embedContent") {
		return newRouteTarget(routeKindGeminiEmbedContent, requestPath, "/v1beta/models/{model}:embedContent")
	}
	return newRouteTarget(routeKindGeminiGenerateContent, requestPath, "/v1beta/models/{model}:generateContent")
}

func newRouteTarget(kind routeKind, paths ...string) routeTarget {
	return routeTarget{
		candidates: uniqueRouteCandidates(paths...),
		kind:       kind,
	}
}

func requestPathOnly(requestURLPath string) string {
	path, _, _ := strings.Cut(strings.TrimSpace(requestURLPath), "?")
	return path
}

func uniqueRouteCandidates(paths ...string) []string {
	candidates := make([]string, 0, len(paths))
	seen := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		if _, ok := seen[path]; ok {
			continue
		}
		seen[path] = struct{}{}
		candidates = append(candidates, path)
	}
	return candidates
}

func geminiRouteKindFromPath(routePath string) (routeKind, bool) {
	_, modelAndAction, ok := splitGeminiRoutePath(routePath)
	if !ok {
		return "", false
	}
	for _, routeSuffix := range geminiRouteSuffixes {
		if strings.HasSuffix(modelAndAction, routeSuffix.suffix) {
			model := strings.TrimSuffix(modelAndAction, routeSuffix.suffix)
			return routeSuffix.kind, strings.TrimSpace(model) != ""
		}
	}
	return "", false
}

func normalizeGeminiRoutePath(routePath string) string {
	prefix, modelAndAction, ok := splitGeminiRoutePath(routePath)
	if !ok {
		return routePath
	}
	for _, routeSuffix := range geminiRouteSuffixes {
		if strings.HasSuffix(modelAndAction, routeSuffix.suffix) {
			return prefix + "{model}" + routeSuffix.suffix
		}
	}
	return routePath
}

func splitGeminiRoutePath(routePath string) (string, string, bool) {
	switch {
	case strings.HasPrefix(routePath, geminiV1BetaModelsPrefix):
		return geminiV1BetaModelsPrefix, strings.TrimPrefix(routePath, geminiV1BetaModelsPrefix), true
	case strings.HasPrefix(routePath, geminiV1ModelsPrefix):
		return geminiV1ModelsPrefix, strings.TrimPrefix(routePath, geminiV1ModelsPrefix), true
	default:
		return "", "", false
	}
}

func isTransformerAllowed(kind routeKind, transformer dto.CustomEndpointTransformer) bool {
	allowed := allowedTransformersByRouteKind[kind]
	_, ok := allowed[transformer]
	return ok
}

func unsupportedTransformer(routePath string, transformer dto.CustomEndpointTransformer) error {
	return fmt.Errorf("custom endpoint route %s does not support transformer %s", routePath, transformer)
}
