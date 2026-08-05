package gondola

// ModelList is a seed list of commonly used Gondola models. Gondola is a
// marketplace, so its catalog changes over time; the full, always-current list
// is available without authentication at https://api.gondola-ai.com/v1/models
// and can be pulled into a channel with the "Fetch Models" button.
var ModelList = []string{
	"deepseek-v4-flash",
	"claude-sonnet-5",
	"kimi-k2-7-code",
	"hermes-3-llama-3.1-405b",
	"venice-uncensored-1-2",
}

var ChannelName = "gondola"
