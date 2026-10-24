package deepseek

import "github.com/QuantumNous/new-api/constant"

var ModelList = []string{
	"deepseek-flash", "deepseek-flash-none", "deepseek-flash-low", "deepseek-flash-max",
	"deepseek-v4-pro", "deepseek-v4-pro-none", "deepseek-v4-pro-low", "deepseek-v4-pro-max",
	constant.DeepSeekSearchModel, constant.DeepSeekFetchModel,
}

var ChannelName = "deepseek"

// Tool-price keys of the DeepSeek Search and Fetch APIs. They price the
// server-side searches and page fetches DeepSeek runs on its Anthropic and
// Responses endpoints.
const (
	SearchToolPriceKey = "deepseek_search"
	FetchToolPriceKey  = "deepseek_fetch"
)
