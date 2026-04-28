package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestOpenAITextResponsePreservesMessageAudio(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"id":"chatcmpl-audio",
		"object":"chat.completion",
		"created":1,
		"model":"mimo-v2.5-tts",
		"choices":[{
			"index":0,
			"message":{
				"role":"assistant",
				"content":null,
				"audio":{"id":"audio_123","data":"QUJD","expires_at":123,"transcript":"ABC"}
			},
			"finish_reason":"stop"
		}],
		"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}
	}`)

	var resp OpenAITextResponse
	require.NoError(t, common.Unmarshal(body, &resp))
	require.JSONEq(t, `{"id":"audio_123","data":"QUJD","expires_at":123,"transcript":"ABC"}`, string(resp.Choices[0].Message.Audio))

	encoded, err := common.Marshal(resp)
	require.NoError(t, err)

	var roundTrip map[string]any
	require.NoError(t, common.Unmarshal(encoded, &roundTrip))
	choice := roundTrip["choices"].([]any)[0].(map[string]any)
	message := choice["message"].(map[string]any)
	audio := message["audio"].(map[string]any)
	require.Equal(t, "QUJD", audio["data"])
	require.Equal(t, "ABC", audio["transcript"])
}
