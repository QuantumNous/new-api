package deepseek

var ModelList = []string{
	// current catalogue (V4)
	"deepseek-v4-pro", "deepseek-v4-pro-none", "deepseek-v4-pro-max",
	"deepseek-v4-flash", "deepseek-v4-flash-none", "deepseek-v4-flash-max",
	// legacy aliases — DeepSeek discontinued these on 2026-07-24; kept so
	// existing channel configs keep resolving in the admin UI.
	"deepseek-chat", "deepseek-reasoner",
}

var ChannelName = "deepseek"
