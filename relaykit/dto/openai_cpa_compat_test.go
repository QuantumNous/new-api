package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestCPABuiltInToolOptionsSurviveChatRequestRoundTrip(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-5.6-sol",
		"messages":[{"role":"user","content":"draw a searched landmark"}],
		"tools":[
			{"type":"image_generation","size":"1536x1024","quality":"high","output_format":"png"},
			{"type":"web_search","search_context_size":"high","user_location":{"type":"approximate","country":"US"}}
		]
	}`)

	var request GeneralOpenAIRequest
	require.NoError(t, kitutil.Unmarshal(raw, &request))
	out, err := kitutil.Marshal(request)
	require.NoError(t, err)

	assert.Equal(t, "image_generation", gjson.GetBytes(out, "tools.0.type").String())
	assert.Equal(t, "1536x1024", gjson.GetBytes(out, "tools.0.size").String())
	assert.Equal(t, "high", gjson.GetBytes(out, "tools.0.quality").String())
	assert.Equal(t, "png", gjson.GetBytes(out, "tools.0.output_format").String())
	assert.False(t, gjson.GetBytes(out, "tools.0.function").Exists())
	assert.Equal(t, "web_search", gjson.GetBytes(out, "tools.1.type").String())
	assert.Equal(t, "high", gjson.GetBytes(out, "tools.1.search_context_size").String())
	assert.Equal(t, "US", gjson.GetBytes(out, "tools.1.user_location.country").String())
	assert.False(t, gjson.GetBytes(out, "tools.1.function").Exists())
}

func TestCPAChatImageResultsSurviveResponseRoundTrip(t *testing.T) {
	nonStream := []byte(`{
		"choices":[{"index":0,"message":{"role":"assistant","content":"","images":[{"image_url":{"url":"data:image/png;base64,abc"}}]},"finish_reason":"stop"}],
		"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}
	}`)
	var response OpenAITextResponse
	require.NoError(t, kitutil.Unmarshal(nonStream, &response))
	out, err := kitutil.Marshal(response)
	require.NoError(t, err)
	assert.Equal(t, "data:image/png;base64,abc", gjson.GetBytes(out, "choices.0.message.images.0.image_url.url").String())

	stream := []byte(`{
		"choices":[{"index":0,"delta":{"role":"assistant","images":[{"image_url":{"url":"data:image/png;base64,xyz"}}]},"finish_reason":null}],
		"usage":null
	}`)
	var chunk ChatCompletionsStreamResponse
	require.NoError(t, kitutil.Unmarshal(stream, &chunk))
	out, err = kitutil.Marshal(chunk)
	require.NoError(t, err)
	assert.Equal(t, "data:image/png;base64,xyz", gjson.GetBytes(out, "choices.0.delta.images.0.image_url.url").String())
}
