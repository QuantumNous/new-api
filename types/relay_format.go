package types

type RelayFormat string

const (
	RelayFormatOpenAI            RelayFormat = "openai"
	RelayFormatClaude                        = "claude"
	RelayFormatClaudeCountTokens             = "claude_count_tokens"
	RelayFormatGemini                        = "gemini"
	RelayFormatOpenAIResponses               = "openai_responses"
	RelayFormatOpenAIAudio                   = "openai_audio"
	RelayFormatOpenAIImage                   = "openai_image"
	RelayFormatOpenAIRealtime                = "openai_realtime"
	RelayFormatRerank                        = "rerank"
	RelayFormatEmbedding                     = "embedding"

	RelayFormatTask    = "task"
	RelayFormatMjProxy = "mj_proxy"
)
