package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRealtimeUsageUnmarshal(t *testing.T) {
	message := []byte(`{
		"type":"response.done",
		"response":{"usage":{
			"total_tokens":399,
			"input_tokens":77,
			"output_tokens":322,
			"input_token_details":{
				"text_tokens":77,
				"audio_tokens":0,
				"image_tokens":0,
				"cached_tokens":0,
				"cached_tokens_details":{"text_tokens":0,"audio_tokens":0,"image_tokens":0}
			},
			"output_token_details":{"text_tokens":76,"audio_tokens":246,"reasoning_tokens":16}
		}}
	}`)

	var event RealtimeEvent
	require.NoError(t, json.Unmarshal(message, &event))
	require.NotNil(t, event.Response)
	require.NotNil(t, event.Response.Usage)
	require.Equal(t, 399, event.Response.Usage.TotalTokens)
	require.Equal(t, 77, event.Response.Usage.InputTokens)
	require.Equal(t, 322, event.Response.Usage.OutputTokens)
	require.Equal(t, 77, event.Response.Usage.InputTokenDetails.TextTokens)
	require.Equal(t, 0, event.Response.Usage.InputTokenDetails.CachedTokensDetails.TextTokens)
	require.Equal(t, 76, event.Response.Usage.OutputTokenDetails.TextTokens)
	require.Equal(t, 246, event.Response.Usage.OutputTokenDetails.AudioTokens)
	require.Equal(t, 16, event.Response.Usage.OutputTokenDetails.ReasoningTokens)
}
