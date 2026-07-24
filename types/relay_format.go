package types

import "strings"

type RelayFormat string

const (
	RelayFormatOpenAI                    RelayFormat = "openai"
	RelayFormatClaude                                = "claude"
	RelayFormatGemini                                = "gemini"
	RelayFormatOpenAIResponses                       = "openai_responses"
	RelayFormatOpenAIResponsesCompaction             = "openai_responses_compaction"
	RelayFormatOpenAIAudio                           = "openai_audio"
	RelayFormatOpenAIImage                           = "openai_image"
	RelayFormatOpenAIRealtime                        = "openai_realtime"
	RelayFormatRerank                                = "rerank"
	RelayFormatEmbedding                             = "embedding"

	RelayFormatTask    = "task"
	RelayFormatMjProxy = "mj_proxy"
)

// RelayFormatToAPIType maps the client request relay format to the expected provider API type.
// This is used for smart channel routing: prefer channels whose native API type matches
// the client's request format, avoiding unnecessary request/response conversion.
func RelayFormatToAPIType(relayFormat RelayFormat) (int, bool) {
	switch relayFormat {
	case RelayFormatOpenAI, RelayFormatOpenAIAudio, RelayFormatOpenAIImage, RelayFormatOpenAIRealtime, RelayFormatOpenAIResponses, RelayFormatOpenAIResponsesCompaction:
		return 0, true // APITypeOpenAI
	case RelayFormatClaude:
		return 1, true // APITypeAnthropic
	case RelayFormatGemini:
		return 13, true // APITypeGemini
	case RelayFormatEmbedding:
		// Embedding requests can be handled by multiple provider types;
		// return OpenAI as the most common format, but let the caller
		// decide whether to enforce strict matching.
		return 0, true // APITypeOpenAI
	case RelayFormatRerank:
		return 0, true // APITypeOpenAI
	default:
		return 0, false
	}
}

// InferRelayFormatFromPath returns the RelayFormat that the request to the given URL path will
// eventually be relayed as. The middleware Distribute() runs before the per-route handler that
// sets the format explicitly, so smart channel routing has to peek at the path here.
//
// Keep this in sync with router/relay-router.go. Unknown paths return an empty RelayFormat,
// which downstream callers (e.g. model.GetChannel) treat as "no API-type hint" and fall back
// to the original priority/weight-based selection.
func InferRelayFormatFromPath(path string) RelayFormat {
	switch {
	case strings.HasPrefix(path, "/v1/messages"):
		return RelayFormatClaude
	case strings.HasPrefix(path, "/v1/responses/compact"):
		return RelayFormatOpenAIResponsesCompaction
	case strings.HasPrefix(path, "/v1/responses"):
		return RelayFormatOpenAIResponses
	case strings.HasPrefix(path, "/v1/realtime"):
		return RelayFormatOpenAIRealtime
	case strings.HasPrefix(path, "/v1/embeddings"):
		return RelayFormatEmbedding
	case strings.HasPrefix(path, "/v1/rerank"):
		return RelayFormatRerank
	case strings.HasPrefix(path, "/v1/audio/"):
		return RelayFormatOpenAIAudio
	case strings.HasPrefix(path, "/v1/images/"), strings.HasPrefix(path, "/v1/edits"):
		return RelayFormatOpenAIImage
	case strings.HasPrefix(path, "/v1/engines/") && strings.HasSuffix(path, "/embeddings"):
		return RelayFormatEmbedding
	case strings.HasPrefix(path, "/v1beta/models/"), strings.HasPrefix(path, "/v1/models/"):
		return RelayFormatGemini
	default:
		return ""
	}
}
