package types

type RelayFormat string

const (
	RelayFormatOpenAI                    RelayFormat = "openai"
	RelayFormatClaude                                = "claude"
	RelayFormatGemini                                = "gemini"
	RelayFormatGeminiInteractions                    = "gemini_interactions"
	RelayFormatOpenAIResponses                       = "openai_responses"
	RelayFormatOpenAIResponsesCompaction             = "openai_responses_compaction"
	RelayFormatOpenAIAudio                           = "openai_audio"
	RelayFormatOpenAIImage                           = "openai_image"
	RelayFormatOpenAIRealtime                        = "openai_realtime"
	RelayFormatRerank                                = "rerank"
	RelayFormatEmbedding                             = "embedding"
	RelayFormatMiniMax                               = "minimax"
	RelayFormatXAI                                   = "xai"
	RelayFormatXAIRealtime                           = "xai_realtime"
	RelayFormatMoarkNative                           = "moark_native"
	RelayFormatStepFunNative                         = "stepfun_native"
	RelayFormatCohereNative                          = "cohere_native"
	RelayFormatStepFunWss                            = "stepfun_wss"
	RelayFormatOCR                                   = "ocr"
	RelayFormatTypeSafe                              = "typesafe"

	RelayFormatTask    = "task"
	RelayFormatMjProxy = "mj_proxy"
)
