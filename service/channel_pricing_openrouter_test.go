package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseOpenRouterModelPrices(t *testing.T) {
	body := []byte(`{
		"data": [
			{
				"id": "anthropic/claude-fable-5",
				"pricing": {
					"prompt": "0.00001",
					"completion": "0.00005",
					"input_cache_read": "0.000001",
					"input_cache_write": "0.0000125"
				}
			},
			{
				"id": "free-model",
				"pricing": {"prompt": "0", "completion": "0"}
			}
		]
	}`)
	prices, err := parseOpenRouterModelPrices(body)
	require.NoError(t, err)
	require.InDelta(t, 10.0, prices["anthropic/claude-fable-5"].InputPrice, 0.0001)
	require.InDelta(t, 50.0, prices["anthropic/claude-fable-5"].OutputPrice, 0.0001)
	require.InDelta(t, 1.0, prices["anthropic/claude-fable-5"].CachePrice, 0.0001)
	require.InDelta(t, 12.5, prices["anthropic/claude-fable-5"].CacheCreationPrice, 0.0001)
	require.InDelta(t, 0.0, prices["free-model"].InputPrice, 0.0001)
}

func TestChannelModelsFromList(t *testing.T) {
	require.Equal(t, []string{"claude-fable-5", "claude-sonnet-4-6"},
		channelModelsFromList("claude-fable-5, claude-sonnet-4-6"))
}
