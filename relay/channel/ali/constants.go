package ali

import "strings"

type aliAudioTranscriptionProtocol int

const (
	aliAudioTranscriptionProtocolUnsupported aliAudioTranscriptionProtocol = iota
	aliAudioTranscriptionProtocolLegacyMultimodal
	aliAudioTranscriptionProtocolQwenASRMultimodal
)

var aliAudioTranscriptionProtocols = map[string]aliAudioTranscriptionProtocol{
	"qwen-audio-3.0-asr-flash": aliAudioTranscriptionProtocolLegacyMultimodal,
	"fun-asr-flash-2026-06-15": aliAudioTranscriptionProtocolLegacyMultimodal,
	"qwen3-asr-flash":          aliAudioTranscriptionProtocolQwenASRMultimodal,
	"qwen3-asr-flash-us":       aliAudioTranscriptionProtocolQwenASRMultimodal,
}

func aliAudioTranscriptionProtocolFor(modelName string) aliAudioTranscriptionProtocol {
	return aliAudioTranscriptionProtocols[strings.ToLower(strings.TrimSpace(modelName))]
}

var ModelList = []string{
	"qwen-turbo",
	"qwen-plus",
	"qwen-max",
	"qwen-max-longcontext",
	"qwq-32b",
	"qwen3-235b-a22b",
	"qwen-audio-3.0-asr-flash",
	"fun-asr-flash-2026-06-15",
	"qwen3-asr-flash",
	"qwen3-asr-flash-us",
	"text-embedding-v1",
	"gte-rerank-v2",
}

var ChannelName = "ali"
