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

	// RelayFormatElevenLabs passes ElevenLabs' native voice/SFX endpoints
	// through verbatim (see relay.ElevenLabsHelper).
	RelayFormatElevenLabs = "elevenlabs"
)
