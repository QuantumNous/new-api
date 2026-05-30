package ali

// https://help.aliyun.com/zh/model-studio/voice-clone-design-http-api
// https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide

var ModelList = []string{
	// Chat models
	"qwen-turbo",
	"qwen-plus",
	"qwen-max",
	"qwen-max-longcontext",
	"qwq-32b",
	"qwen3-235b-a22b",
	// TTS models - 语音合成
	"qwen-tts",
	"qwen-tts-latest",
	"qwen3-tts-flash",
	"qwen3-tts-vc-realtime-2026-01-15",
	// Voice clone models - 语音克隆
	"qwen-voice-clone",
	"qwen-voice-enrollment",
	// Embedding and rerank models
	"text-embedding-v1",
	"gte-rerank-v2",
}

var ChannelName = "ali"
