package types

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
