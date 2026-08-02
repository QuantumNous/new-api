package avalai

// https://docs.avalai.ir
// AvalAI is an OpenAI-compatible AI gateway that proxies models from
// OpenAI, Anthropic, Google, DeepSeek and other providers.
// The full model list can be fetched from upstream /v1/models.

var ModelList = []string{
	"gpt-4o",
	"gpt-4o-mini",
	"gpt-4.1",
	"gpt-4.1-mini",
	"gpt-4.1-nano",
	"o4-mini",
	"claude-3-5-sonnet-20241022",
	"claude-sonnet-4-20250514",
	"gemini-2.0-flash",
	"gemini-2.5-pro",
	"deepseek-chat",
	"deepseek-reasoner",
}

var ChannelName = "avalai"
