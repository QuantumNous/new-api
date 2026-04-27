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

	// RelayFormatVolc is the native Volc Ark API format.
	// Requests are forwarded byte-identical to the upstream without any
	// body rewriting; Volc-specific fields (sequential_image_generation,
	// optimize_prompt_options, watermark, 2K/4K size literals, etc.) are
	// preserved as-is.
	RelayFormatVolc RelayFormat = "volc"
)
